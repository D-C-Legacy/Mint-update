import { Inject, Injectable } from '@nestjs/common';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { PAYOUT_REPOSITORY, PayoutRepositoryPort } from '../../domain/ports/payout.repository.port';
import { Payout, PayoutStatus } from '../../domain/entities/payout.entity';

export interface ListPayoutsByStatusCommand {
  readonly status: PayoutStatus;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// Added for P8-05's "failed payouts" / "held payouts" admin queues — one query reused for both
// via `status`, rather than two near-identical classes (PayoutsService locks each to its own
// status so the two dashboards stay intention-revealing at the call site).
@Injectable()
export class ListPayoutsByStatusQuery {
  constructor(@Inject(PAYOUT_REPOSITORY) private readonly payouts: PayoutRepositoryPort) {}

  async execute(cmd: ListPayoutsByStatusCommand): Promise<CursorPage<Payout>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.payouts.findByStatus({ status: cmd.status, cursor: cmd.cursor, limit });
    return buildCursorPage(rows, limit);
  }
}
