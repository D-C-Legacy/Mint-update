import type { Payment as PrismaPayment } from '@prisma/client';
import { Payment } from '../../domain/entities/payment.entity';

export function toDomainPayment(row: PrismaPayment): Payment {
  return {
    id: row.id,
    orderId: row.orderId,
    provider: row.provider,
    providerIntentId: row.providerIntentId,
    providerChargeId: row.providerChargeId,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    providerFee: row.providerFee,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    capturedAt: row.capturedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
