import { Inject, Injectable } from '@nestjs/common';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { PAYOUT_REPOSITORY, PayoutRepositoryPort } from '../../domain/ports/payout.repository.port';
import { PayoutRun } from '../../domain/entities/payout-run.entity';

export interface ListPayoutRunsCommand {
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// `GET /admin/payout-runs` (05-API-SPEC.md §11, "List runs") — unowned by any ticket.
@Injectable()
export class ListPayoutRunsQuery {
  constructor(@Inject(PAYOUT_REPOSITORY) private readonly payouts: PayoutRepositoryPort) {}

  async execute(cmd: ListPayoutRunsCommand): Promise<CursorPage<PayoutRun>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.payouts.listRuns({ cursor: cmd.cursor, limit });
    return buildCursorPage(rows, limit);
  }
}
