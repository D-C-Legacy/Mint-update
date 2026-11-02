import type { SellerBalance as PrismaSellerBalance } from '@prisma/client';
import { SellerBalance } from '../../domain/entities/seller-balance.entity';

export function toDomainSellerBalance(row: PrismaSellerBalance): SellerBalance {
  return {
    sellerId: row.sellerId,
    currency: row.currency,
    pendingAmount: row.pendingAmount,
    availableAmount: row.availableAmount,
    paidOutAmount: row.paidOutAmount,
    lastEntryId: row.lastEntryId,
    updatedAt: row.updatedAt,
  };
}
