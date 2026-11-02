import type { Payout as PrismaPayout, PayoutItem as PrismaPayoutItem } from '@prisma/client';
import { Payout } from '../../domain/entities/payout.entity';

type PayoutWithItems = PrismaPayout & { items: PrismaPayoutItem[] };

export function toDomainPayout(row: PayoutWithItems): Payout {
  return {
    id: row.id,
    runId: row.runId,
    sellerId: row.sellerId,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    providerTransferId: row.providerTransferId,
    failureReason: row.failureReason,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
    items: row.items.map((item) => ({ id: item.id, payoutId: item.payoutId, orderId: item.orderId, amount: item.amount })),
  };
}
