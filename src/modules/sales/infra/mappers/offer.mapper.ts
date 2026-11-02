import type { Offer as PrismaOffer } from '@prisma/client';
import { Offer } from '../../domain/entities/offer.entity';

export function toDomainOffer(row: PrismaOffer): Offer {
  return {
    id: row.id,
    saleId: row.saleId,
    userId: row.userId,
    amount: row.amount,
    status: row.status,
    counterAmount: row.counterAmount,
    respondedAt: row.respondedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}
