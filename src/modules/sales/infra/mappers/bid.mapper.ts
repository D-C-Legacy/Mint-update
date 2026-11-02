import type { Bid as PrismaBid } from '@prisma/client';
import { Bid } from '../../domain/entities/bid.entity';

export function toDomainBid(row: PrismaBid): Bid {
  return {
    id: row.id,
    saleId: row.saleId,
    userId: row.userId,
    amount: row.amount,
    status: row.status,
    sequence: row.sequence,
    createdAt: row.createdAt,
  };
}
