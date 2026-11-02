import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { redisConfig } from '../../../../config/redis.config';
import { QueueNames } from '../../../../platform/queue/queue.names';
import { QueueService } from '../../../../platform/queue/queue.service';
import { RedisService } from '../../../../platform/redis/redis.service';
import { wrapJobProcessor } from '../../../../platform/observability/job-wrapper';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../../domain/ports/stream-session.repository.port';
import { STREAM_PROVIDER, StreamProviderPort } from '../../domain/ports/stream-provider.port';
import { SessionStatsFinalizer } from '../../application/session-stats-finalizer.service';
import { AutoAdvanceQueueUseCase } from '../../application/commands/auto-advance-queue.usecase';

const RECONCILE_JOB_NAME = 'stream.reconcile';
const RECONCILE_JOB_ID = 'stream-reconcile';
const RECONCILE_INTERVAL_MS = 60_000;

// Auto-queue advance (round5 §5, 26 Oct 2026) needs a much tighter poll than the 60s liveness
// reconcile above — its own grace period after a sale resolves is just 12s (AutoAdvanceQueueUseCase),
// and stacking a 60s poll on top of that would turn "a short grace period" into "up to 72s," which
// isn't what was asked for. Sharing this processor's existing Worker/connection rather than standing
// up a second one, per this class's own precedent: a BullMQ Worker is expensive enough (its own
// blocking-command connection) to be worth reusing across tick kinds, not one per job.
const AUTO_ADVANCE_JOB_NAME = 'stream.queue.auto-advance';
const AUTO_ADVANCE_JOB_ID = 'stream-queue-auto-advance';
const AUTO_ADVANCE_INTERVAL_MS = 5_000;
// A freshly-started session gets this long before "nothing broadcasting yet" counts as dead.
// Originally there was no grace period at all (end on the very next tick after start), which
// required the seller to already have OBS/RTMP configured and paste fresh credentials within
// ~60s of clicking "Go Live" — confirmed live, 16 Oct 2026, that this is unrealistic in practice:
// a real attempt had OBS genuinely connected and broadcasting to AWS, but the app had already
// auto-ended the session moments earlier, so the stream never showed as live anywhere. A session
// that WAS broadcasting and then genuinely drops is unaffected — it still ends within one
// reconcile tick once this window has passed.
const BROADCAST_GRACE_PERIOD_MS = 5 * 60_000;

// Founder-reported (22 Oct 2026): reconnecting OBS (or any brief RTMP drop/reconnect) was ending
// the session outright. Root cause — IVS's GetStream throws ChannelNotBroadcasting the instant
// nothing is being pushed, which is true for the first few seconds of any reconnect, not just a
// genuine abandonment; the reconcile tick had zero tolerance for that and ended the session on the
// very next poll. ENDED is terminal (stream-status-transition.rule.ts), so this forced the seller
// into a brand new session — a brand new IVS channel, a brand new stream key — exactly the "the
// code shouldn't change" complaint. Fix: require the channel to be continuously not-broadcasting
// for this long before ending, not just "not broadcasting on the one tick we happened to poll."
// Long enough to comfortably cover a real OBS reconnect (seconds, worst case well under a minute),
// short enough to still satisfy the founder's own ask for "guardrails" against a stream sitting
// live-but-abandoned for a long time.
const DISCONNECT_GRACE_PERIOD_MS = 3 * 60_000;
// Self-expiring (same reasoning as presence.service.ts's own keys) so a session that gets ended by
// some other path (manual End Stream, kill) doesn't leave a stale miss-tracking key behind forever.
const MISSED_BROADCAST_KEY_TTL_MS = DISCONNECT_GRACE_PERIOD_MS + 60_000;

function missedBroadcastKey(sessionId: string): string {
  return `stream:reconcile:missedBroadcastSince:${sessionId}`;
}

// First BullMQ Worker (job consumer) in this codebase — platform/queue/queue.service.ts only
// wrote to queues before this. A Worker needs its own dedicated Redis connection (it issues
// blocking commands; it must not share QueueService's connection), so it's constructed directly
// here rather than through a platform abstraction — same per-module-owns-its-processor shape the
// naming convention table already implies (`modules/ledger/infra/jobs/reconcile.processor.ts` in
// P7-08 is the next ticket to need this same pattern).
//
// Runs in all three processes today (AppModule is shared, unextracted per-process composition —
// see MEMORY.md). Unlike the P3-04 event-bus case, this is harmless by BullMQ design, not just by
// accident: a Worker only ever claims a job that no other worker on the same queue has claimed,
// so three redundant Workers compete rather than triple-process the same tick.
@Injectable()
export class StreamReconcileProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly connection = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });
  private readonly worker = new Worker(
    QueueNames.STREAMING,
    wrapJobProcessor(QueueNames.STREAMING, async (job) => {
      if (job.name === RECONCILE_JOB_NAME) {
        await this.reconcile();
      } else if (job.name === AUTO_ADVANCE_JOB_NAME) {
        await this.autoAdvanceQueues();
      }
    }),
    { connection: this.connection },
  );

  constructor(
    private readonly queueService: QueueService,
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    @Inject(STREAM_PROVIDER) private readonly provider: StreamProviderPort,
    private readonly statsFinalizer: SessionStatsFinalizer,
    private readonly autoAdvanceQueueUseCase: AutoAdvanceQueueUseCase,
    // Shared client, not `this.connection` — that one's reserved for the BullMQ Worker's blocking
    // commands per this class's own existing comment; miss-tracking is plain key reads/writes.
    private readonly redis: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queueService.scheduleRepeating(
      QueueNames.STREAMING,
      RECONCILE_JOB_NAME,
      {},
      RECONCILE_INTERVAL_MS,
      RECONCILE_JOB_ID,
    );
    await this.queueService.scheduleRepeating(
      QueueNames.STREAMING,
      AUTO_ADVANCE_JOB_NAME,
      {},
      AUTO_ADVANCE_INTERVAL_MS,
      AUTO_ADVANCE_JOB_ID,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }

  // Public so a tick can be forced on demand for verification — same reasoning as
  // PresenceService.reapNow(): proving a periodic sweep works doesn't require actually waiting out
  // its real-world interval.
  async reconcile(): Promise<void> {
    const liveSessions = await this.sessions.findAllLive();
    const now = Date.now();
    await Promise.all(
      liveSessions.map(async (session) => {
        if (!session.providerRoomId) {
          return;
        }
        if (session.startedAt && now - session.startedAt.getTime() < BROADCAST_GRACE_PERIOD_MS) {
          return;
        }
        const exists = await this.provider.roomExists(session.providerRoomId);
        const key = missedBroadcastKey(session.id);
        if (exists) {
          await this.redis.client.del(key);
          return;
        }

        // First tick that's seen this session not broadcasting: record it and wait, don't end yet
        // — most of the time this is just a reconnect in progress.
        const setResult = await this.redis.client.set(
          key,
          String(now),
          'PX',
          MISSED_BROADCAST_KEY_TTL_MS,
          'NX',
        );
        let missingSince = now;
        if (setResult !== 'OK') {
          const existing = await this.redis.client.get(key);
          missingSince = existing ? Number(existing) : now;
        }
        if (now - missingSince < DISCONNECT_GRACE_PERIOD_MS) {
          return;
        }

        const ended = await this.sessions.endIfLive(session.id, new Date());
        if (ended) {
          await this.redis.client.del(key);
          await this.statsFinalizer.finalize(ended.id);
        }
      }),
    );
  }

  // Public for the same on-demand-verification reason as reconcile() above. Filters in memory
  // rather than a dedicated repository query — the number of concurrently live sessions on this
  // platform today is small, and findAllLive() already exists for the sibling tick above.
  async autoAdvanceQueues(): Promise<void> {
    const liveSessions = await this.sessions.findAllLive();
    const candidates = liveSessions.filter((session) => session.autoQueueEnabled);
    await Promise.all(
      candidates.map((session) => this.autoAdvanceQueueUseCase.execute({ sessionId: session.id })),
    );
  }
}
