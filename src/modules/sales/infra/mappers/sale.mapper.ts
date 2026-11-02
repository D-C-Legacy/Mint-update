import type { Sale as PrismaSale } from '@prisma/client';
import { Sale } from '../../domain/entities/sale.entity';

export function toDomainSale(row: PrismaSale): Sale {
  return {
    id: row.id,
    sessionId: row.sessionId,
    sellerId: row.sellerId,
    productId: row.productId,
    mode: row.mode,
    status: row.status,
    currency: row.currency,
    startAmount: row.startAmount,
    currentAmount: row.currentAmount,
    currentBidId: row.currentBidId,
    endsAt: row.endsAt,
    extensionCount: row.extensionCount,
    price: row.price,
    quantity: row.quantity,
    winnerUserId: row.winnerUserId,
    finalAmount: row.finalAmount,
    resolvedAt: row.resolvedAt,
    orderId: row.orderId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
