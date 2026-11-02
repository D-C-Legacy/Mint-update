import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { PAYOUT_REPOSITORY, PayoutRepositoryPort } from '../../domain/ports/payout.repository.port';
import { PayoutNotFoundError } from '../../domain/errors/payouts.errors';
import { PayoutStatus } from '../../domain/entities/payout.entity';

export interface GetPayoutStatementCommand {
  readonly payoutId: string;
}

export interface PayoutStatementItem {
  readonly orderId: string;
  readonly amount: bigint;
}

// 05-API-SPEC.md §10: `GET /seller/payouts/:id | seller | Statement with the orders covered`.
// Built as a plain query now, same "logic lands before its HTTP ticket" precedent as every
// prior unreachable-but-correct application layer in this build (orders/payments) — no payouts
// HTTP route exists in any of the 65 tickets. Ownership scoping (a seller may only read their
// own payout) is left to whichever ticket builds that route, same as every other query that
// predates its controller.
export interface PayoutStatement {
  readonly payoutId: string;
  readonly sellerId: string;
  readonly amount: bigint;
  readonly currency: string;
  readonly status: PayoutStatus;
  readonly sentAt: Date | null;
  readonly items: readonly PayoutStatementItem[];
}

@Injectable()
export class GetPayoutStatementQuery {
  constructor(@Inject(PAYOUT_REPOSITORY) private readonly payouts: PayoutRepositoryPort) {}

  async execute(cmd: GetPayoutStatementCommand): Promise<Result<PayoutStatement, PayoutNotFoundError>> {
    const payout = await this.payouts.findPayoutById(cmd.payoutId);
    if (!payout) {
      return Err(new PayoutNotFoundError(cmd.payoutId));
    }

    return Ok({
      payoutId: payout.id,
      sellerId: payout.sellerId,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      sentAt: payout.sentAt,
      items: payout.items.map((item) => ({ orderId: item.orderId, amount: item.amount })),
    });
  }
}
