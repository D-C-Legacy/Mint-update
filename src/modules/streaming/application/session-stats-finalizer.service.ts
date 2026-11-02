import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../domain/ports/stream-session.repository.port';
import { PresenceService } from '../infra/presence.service';
import { SalesService } from '../../sales/application/sales.service';

// Called once by each path that can end a session (end/kill/webhook/reconcile), right after that
// path's own status transition already succeeded. Reads the two real data sources — Redis
// presence (peak concurrent viewers) and Sales (itemsSold/grossAmount, via the Streaming ->
// Sales import StreamingModule already has) — and writes a single snapshot onto StreamSession.
// peakViewers/itemsSold/grossAmount existed as schema columns with no write path anywhere in the
// codebase before this; this is that write path, per 06-REALTIME-AND-CONCURRENCY.md §8's own
// stated (but previously unbuilt) intent.
@Injectable()
export class SessionStatsFinalizer {
  private readonly logger = new Logger(SessionStatsFinalizer.name);

  constructor(
    private readonly presence: PresenceService,
    private readonly sales: SalesService,
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
  ) {}

  // Deliberately swallows its own failures: this is a best-effort analytics snapshot, not part
  // of the session-ending action itself. A seller's "End stream" (or the admin kill / webhook /
  // reconcile paths) must succeed even if Redis or this one extra query has a transient blip —
  // the session has already ended by the time this runs, and losing one session's stats is a
  // minor, recoverable gap, not a reason to fail an action that already completed.
  async finalize(sessionId: string): Promise<void> {
    try {
      const [peakViewers, salesStats] = await Promise.all([
        this.presence.getPeakViewerCount(sessionId),
        this.sales.getSessionSalesStats({ sessionId }),
      ]);
      await this.sessions.updateStats(sessionId, {
        peakViewers,
        itemsSold: salesStats.itemsSold,
        grossAmount: salesStats.grossAmount,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to finalize session stats for ${sessionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
