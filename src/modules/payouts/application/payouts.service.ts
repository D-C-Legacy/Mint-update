import { Injectable } from '@nestjs/common';
import { Result, Err } from '../../../shared/result/result';
import { CursorPage } from '../../../shared/pagination/cursor';
import { RunPayoutUseCase, RunPayoutResult } from './commands/run-payout.usecase';
import {
  GetPayoutStatementQuery,
  GetPayoutStatementCommand,
  PayoutStatement,
} from './queries/get-payout-statement.query';
import { ListPayoutsByStatusQuery } from './queries/list-payouts-by-status.query';
import { ListPayoutRunsQuery, ListPayoutRunsCommand } from './queries/list-payout-runs.query';
import { HoldPayoutUseCase, HoldPayoutCommand } from './commands/hold-payout.usecase';
import { InvalidPayoutStatusError, PayoutNotFoundError } from '../domain/errors/payouts.errors';
import { Payout, PayoutStatus } from '../domain/entities/payout.entity';
import { PayoutRun } from '../domain/entities/payout-run.entity';
import { ListMyPayoutsQuery, ListMyPayoutsCommand } from './queries/list-my-payouts.query';
import { SellersService } from '../../sellers/application/sellers.service';
import { SellerApplicationNotFoundError } from '../../sellers/domain/errors/sellers.errors';

export interface GetMyStatementCommand {
  readonly userId: string;
  readonly payoutId: string;
}

export interface ListPayoutsPageCommand {
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

export interface ListPayoutsCommand extends ListPayoutsPageCommand {
  readonly status: PayoutStatus;
}

@Injectable()
export class PayoutsService {
  constructor(
    private readonly runPayoutUseCase: RunPayoutUseCase,
    private readonly getPayoutStatementQuery: GetPayoutStatementQuery,
    private readonly listPayoutsByStatusQuery: ListPayoutsByStatusQuery,
    private readonly listPayoutRunsQuery: ListPayoutRunsQuery,
    private readonly holdPayoutUseCase: HoldPayoutUseCase,
    private readonly listMyPayoutsQuery: ListMyPayoutsQuery,
    private readonly sellers: SellersService,
  ) {}

  async runPayout(): Promise<RunPayoutResult> {
    return this.runPayoutUseCase.execute();
  }

  async getStatement(
    cmd: GetPayoutStatementCommand,
  ): Promise<Result<PayoutStatement, PayoutNotFoundError>> {
    return this.getPayoutStatementQuery.execute(cmd);
  }

  // "failed payouts" / "held payouts" admin queues (P8-05) — HELD is a new PayoutStatus value
  // added in this same ticket (05-API-SPEC.md §11 names `POST /admin/payouts/:id/hold`, whose
  // actual transition use case remains P8-06's unbuilt job).
  async listFailedPayouts(cmd: ListPayoutsPageCommand): Promise<CursorPage<Payout>> {
    return this.listPayoutsByStatusQuery.execute({ status: 'FAILED', ...cmd });
  }

  async listHeldPayouts(cmd: ListPayoutsPageCommand): Promise<CursorPage<Payout>> {
    return this.listPayoutsByStatusQuery.execute({ status: 'HELD', ...cmd });
  }

  // `GET /admin/payouts?status=` (admin-portal Phase 3) — the general-purpose counterpart to
  // listFailedPayouts/listHeldPayouts above, same query, any status. `status` stays required
  // here rather than optional like orders' listOrders: PayoutRepositoryPort.findByStatus has no
  // "all statuses" mode (ListByStatusFilter.status is non-optional, unlike OrderRepositoryPort's),
  // so there's no "All" view to offer — flagged, not papered over with a fake default status.
  async listPayouts(cmd: ListPayoutsCommand): Promise<CursorPage<Payout>> {
    return this.listPayoutsByStatusQuery.execute(cmd);
  }

  async listRuns(cmd: ListPayoutRunsCommand): Promise<CursorPage<PayoutRun>> {
    return this.listPayoutRunsQuery.execute(cmd);
  }

  async holdPayout(
    cmd: HoldPayoutCommand,
  ): Promise<Result<Payout, PayoutNotFoundError | InvalidPayoutStatusError>> {
    return this.holdPayoutUseCase.execute(cmd);
  }

  async listMine(
    cmd: ListMyPayoutsCommand,
  ): Promise<Result<CursorPage<Payout>, SellerApplicationNotFoundError>> {
    return this.listMyPayoutsQuery.execute(cmd);
  }

  // `GET /seller/payouts/:id` (05-API-SPEC.md §10: "Statement with the orders covered").
  // `GetPayoutStatementQuery` predates any HTTP route (its own comment: "ownership scoping... is
  // left to whichever ticket builds that route") — this is that ownership check: a seller may
  // only read their own payout, masked as PAYOUT_NOT_FOUND rather than FORBIDDEN, same precedent
  // as every other ownership check in this build.
  async getMyStatement(
    cmd: GetMyStatementCommand,
  ): Promise<Result<PayoutStatement, PayoutNotFoundError | SellerApplicationNotFoundError>> {
    const resolved = await this.sellers.getMySeller({ userId: cmd.userId });
    if (!resolved.ok) {
      return resolved;
    }
    const statement = await this.getPayoutStatementQuery.execute({ payoutId: cmd.payoutId });
    if (!statement.ok) {
      return statement;
    }
    if (statement.value.sellerId !== resolved.value.seller.id) {
      return Err(new PayoutNotFoundError(cmd.payoutId));
    }
    return statement;
  }
}
