import { Payout } from '../../domain/entities/payout.entity';
import { PayoutStatement } from '../../application/queries/get-payout-statement.query';

// Shape for GET /seller/payouts and GET /seller/payouts/:id. Hidden: idempotencyKey and
// providerTransferId (the mock transfer adapter's internal id) — internal, not useful to a seller.
export interface PayoutView {
  readonly id: string;
  readonly runId: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: string;
  readonly failureReason: string | null;
  readonly sentAt: string | null;
  readonly createdAt: string;
  readonly items: ReadonlyArray<{ readonly orderId: string; readonly amount: number }>;
}

export function toPayoutView(payout: Payout): PayoutView {
  return {
    id: payout.id,
    runId: payout.runId,
    amount: Number(payout.amount),
    currency: payout.currency,
    status: payout.status,
    failureReason: payout.failureReason,
    sentAt: payout.sentAt ? payout.sentAt.toISOString() : null,
    createdAt: payout.createdAt.toISOString(),
    items: payout.items.map((item) => ({ orderId: item.orderId, amount: Number(item.amount) })),
  };
}

export interface PayoutStatementView {
  readonly payoutId: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: string;
  readonly sentAt: string | null;
  readonly items: ReadonlyArray<{ readonly orderId: string; readonly amount: number }>;
}

export function toPayoutStatementView(statement: PayoutStatement): PayoutStatementView {
  return {
    payoutId: statement.payoutId,
    amount: Number(statement.amount),
    currency: statement.currency,
    status: statement.status,
    sentAt: statement.sentAt ? statement.sentAt.toISOString() : null,
    items: statement.items.map((item) => ({ orderId: item.orderId, amount: Number(item.amount) })),
  };
}
