import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../../../platform/redis/redis.service';
import { LockService } from '../../../platform/redis/lock.service';
import { roomCountGauge } from '../../../platform/observability/metrics';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../domain/ports/stream-session.repository.port';

const PRESENCE_WINDOW_MS = 45_000;
const BROADCAST_THROTTLE_MS = 1_000;
const REAPER_INTERVAL_MS = 30_000;
// Self-expiring rather than explicitly cleared on session end: covers every path that can end a
// session (end/kill/webhook/reconcile) without each one having to remember to clean this key up,
// same "don't need a cleanup step if it just expires" reasoning as the viewers ZSET's own window.
const PEAK_KEY_TTL_SECONDS = 24 * 60 * 60;

function viewersKey(sessionId: string): string {
  return `room:${sessionId}:viewers`;
}

function peakViewersKey(sessionId: string): string {
  return `room:${sessionId}:peakViewers`;
}

function lastBroadcastCountKey(sessionId: string): string {
  return `room:${sessionId}:viewers:lastCount`;
}

function broadcastLockKey(sessionId: string): string {
  return `room:${sessionId}:viewers:broadcastlock`;
}

export interface PresenceUpdateResult {
  readonly count: number;
  readonly shouldBroadcast: boolean;
}

// 06-REALTIME-AND-CONCURRENCY.md §8: Redis only, never Postgres.
//
// The "at most once per second per room, only when it changed" broadcast throttle is enforced
// here via a Redis NX lock (platform/redis/lock.service.ts, built in P0-04, unused until now),
// not in-memory per-process state. §3 describes multiple realtime instances as the normal
// deployment shape; an in-memory throttle would let every instance decide independently to
// broadcast, and since Socket.IO's redis-adapter fans any one instance's `.to(room).emit()` out
// to clients on every instance (proved live in P4-04), that would mean up to N duplicate
// broadcasts per second per room instead of one. The Redis lock makes "did I win this tick"
// authoritative across every instance. The actual emit still happens in StreamingGateway, since
// only it holds a live Socket.IO server reference — this service only decides whether to.
@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private reaperHandle: NodeJS.Timeout | undefined;

  constructor(
    private readonly redis: RedisService,
    private readonly lock: LockService,
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
  ) {}

  onModuleInit(): void {
    // Runs in all 3 processes today (AppModule is still shared — see MEMORY.md), but harmless:
    // ZREMRANGEBYSCORE on an already-trimmed range is a no-op, so redundant concurrent sweeps
    // don't corrupt anything, same reasoning as StreamReconcileProcessor's note, simpler still
    // since there's no job to compete for at all, just an idempotent command repeated.
    this.reaperHandle = setInterval(() => {
      void this.reapNow();
    }, REAPER_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.reaperHandle) {
      clearInterval(this.reaperHandle);
    }
  }

  async recordHeartbeat(sessionId: string, userId: string): Promise<PresenceUpdateResult> {
    await this.redis.client.zadd(viewersKey(sessionId), Date.now(), userId);
    return this.recalculateAndThrottle(sessionId);
  }

  async removeViewer(sessionId: string, userId: string): Promise<PresenceUpdateResult> {
    await this.redis.client.zrem(viewersKey(sessionId), userId);
    return this.recalculateAndThrottle(sessionId);
  }

  async getViewerCount(sessionId: string, now: number = Date.now()): Promise<number> {
    return this.redis.client.zcount(viewersKey(sessionId), now - PRESENCE_WINDOW_MS, '+inf');
  }

  // Highest `count` this session has ever reached, per 06-REALTIME-AND-CONCURRENCY.md §8's own
  // stated intent ("peak viewers is written to StreamSession.peakViewers when the stream ends")
  // — tracked here since this is the one place that already recomputes `count` on every
  // join/heartbeat/leave, not a second poller. Never written to by this method (read-only).
  async getPeakViewerCount(sessionId: string): Promise<number> {
    const raw = await this.redis.client.get(peakViewersKey(sessionId));
    return raw ? Number(raw) : 0;
  }

  private async recalculateAndThrottle(sessionId: string): Promise<PresenceUpdateResult> {
    const now = Date.now();
    const count = await this.getViewerCount(sessionId, now);
    await this.updatePeakIfHigher(sessionId, count);

    const lastBroadcastRaw = await this.redis.client.get(lastBroadcastCountKey(sessionId));
    if (lastBroadcastRaw !== null && Number(lastBroadcastRaw) === count) {
      return { count, shouldBroadcast: false };
    }

    const acquired = await this.lock.acquire(broadcastLockKey(sessionId), BROADCAST_THROTTLE_MS);
    if (!acquired) {
      return { count, shouldBroadcast: false };
    }

    await this.redis.client.set(lastBroadcastCountKey(sessionId), String(count));
    return { count, shouldBroadcast: true };
  }

  // Read-then-compare-then-set, not an atomic Redis primitive — ioredis has no native "set if
  // greater." A lost race under this just means a slightly-stale peak gets overwritten by another
  // concurrent tick doing the same comparison a moment later; worst case this display-only metric
  // briefly under-reports by one tick's worth of count, never over-reports and never corrupts
  // anything money-related, same risk tolerance as the broadcast throttle's own best-effort lock.
  private async updatePeakIfHigher(sessionId: string, count: number): Promise<void> {
    const current = await this.getPeakViewerCount(sessionId);
    if (count > current) {
      await this.redis.client.set(
        peakViewersKey(sessionId),
        String(count),
        'EX',
        PEAK_KEY_TTL_SECONDS,
      );
    }
  }

  // "every 30s: ZREMRANGEBYSCORE room:123:viewers -inf (now - 45000)" — exactly as documented, a
  // pure sweep with no broadcast side effect. A viewer silently timing out (no explicit
  // room.leave) only shows up in the next heartbeat/join's recalculation, not pushed proactively
  // — the doc's reaper entry doesn't mention a broadcast, and inventing one here would mean
  // solving the same "which instance gets to emit" problem the throttle lock exists for, for a
  // case the spec doesn't actually ask for. Public (not just the internal 30s interval) so a tick
  // can be forced on demand — same reasoning as P4-03's reconcile job verification: proving a
  // periodic sweep works doesn't require actually waiting out its real-world interval.
  async reapNow(): Promise<void> {
    const now = Date.now();
    const liveSessions = await this.sessions.findAllLive();
    // 02-TRD.md §7's "room count" metric, piggybacked on this already-running 30s tick rather
    // than a second timer — this is the one place in the codebase that already periodically asks
    // "which sessions are live right now," so updating the gauge here is free.
    roomCountGauge.set(liveSessions.length);
    await Promise.all(
      liveSessions.map((session) =>
        this.redis.client.zremrangebyscore(
          viewersKey(session.id),
          '-inf',
          now - PRESENCE_WINDOW_MS,
        ),
      ),
    );
  }
}
