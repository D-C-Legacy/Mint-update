import type { PayoutRun as PrismaPayoutRun } from '@prisma/client';
import { PayoutRun } from '../../domain/entities/payout-run.entity';

export function toDomainPayoutRun(row: PrismaPayoutRun): PayoutRun {
  return {
    id: row.id,
    status: row.status,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    totalAmount: row.totalAmount,
    payoutCount: row.payoutCount,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  };
}
