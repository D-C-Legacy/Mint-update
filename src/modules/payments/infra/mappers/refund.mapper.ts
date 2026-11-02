import type { Refund as PrismaRefund } from '@prisma/client';
import { Refund } from '../../domain/entities/refund.entity';

export function toDomainRefund(row: PrismaRefund): Refund {
  return {
    id: row.id,
    paymentId: row.paymentId,
    providerRefundId: row.providerRefundId,
    amount: row.amount,
    reason: row.reason,
    status: row.status,
    initiatedByUserId: row.initiatedByUserId,
    createdAt: row.createdAt,
  };
}
