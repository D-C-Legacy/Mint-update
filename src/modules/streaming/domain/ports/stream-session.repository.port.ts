import { StreamSession } from '../entities/stream-session.entity';

export const STREAM_SESSION_REPOSITORY = Symbol('StreamSessionRepositoryPort');

export interface CreateStreamSessionInput {
  readonly id: string;
  readonly channelId: string;
  readonly title: string;
  readonly scheduledFor: Date | null;
}

export interface StartStreamSessionInput {
  readonly providerRoomId: string;
  readonly startedAt: Date;
}

export interface ListLiveStreamSessionsInput {
  /** ID of the last item on the previous page, or null for the first page. */
  readonly cursor: string | null;
  /** Already normalized by the caller, so the repository fetches `limit + 1` to detect a next page. */
  readonly limit: number;
}

export interface StreamSessionRepositoryPort {
  create(input: CreateStreamSessionInput): Promise<StreamSession>;
  findById(id: string): Promise<StreamSession | null>;
  findByProviderRoomId(providerRoomId: string): Promise<StreamSession | null>;
  findAllLive(): Promise<StreamSession[]>;
  /** Cursor page of LIVE sessions, most recently started first (`GET /streams/live`, 05-API-SPEC.md §6). */
  listLive(input: ListLiveStreamSessionsInput): Promise<StreamSession[]>;
  start(id: string, input: StartStreamSessionInput): Promise<StreamSession>;
  end(id: string, endedAt: Date): Promise<StreamSession>;
  /** `POST /admin/streams/:id/kill` (05-API-SPEC.md §11) — unowned by any ticket. Unconditional,
   *  same as `end()`: the caller (`KillSessionUseCase`) already checked the transition via
   *  `transitionStreamStatus('KILL', ...)` before calling this. */
  cancel(id: string, cancelledAt: Date): Promise<StreamSession>;
  /** Atomic, conditional on current status being LIVE — returns null (no-op) otherwise.
   * Used by system-triggered paths (provider webhook, reconcile job) where redelivery/overlap
   * must not throw on an already-ended session (every background job is idempotent, AGENTS.md §4). */
  endIfLive(id: string, endedAt: Date): Promise<StreamSession | null>;
  /** Unconditional overwrite with freshly-recomputed values — called once by
   *  SessionStatsFinalizer after a session has already finished ending (end/endIfLive/cancel),
   *  never racing a status check of its own. Safe to call more than once for the same session
   *  (every background job is idempotent, AGENTS.md §4): it always writes the latest truth, not
   *  an increment. */
  updateStats(id: string, stats: UpdateSessionStatsInput): Promise<void>;
  /** Sum of `peakViewers` across every session belonging to this seller's channel whose
   *  `startedAt` falls in range — engineering-hardening backlog Phase 2c's "Viewers" dashboard
   *  stat. A session that never started (still SCHEDULED) or started outside the range is
   *  excluded; one still LIVE within range just contributes whatever its peak has reached so
   *  far (0 until `peakViewers` is written at session end) — same honest-incremental reasoning
   *  as the seller order analytics not excluding "in-flight" states. */
  sumPeakViewersForSeller(sellerId: string, range: { from: Date; to: Date }): Promise<number>;
  /** Per-show toggle for the automatic feature-product queue (round5 §5, 26 Oct 2026). */
  setAutoQueueEnabled(id: string, enabled: boolean): Promise<StreamSession>;
}

export interface UpdateSessionStatsInput {
  readonly peakViewers: number;
  readonly itemsSold: number;
  readonly grossAmount: bigint;
}
