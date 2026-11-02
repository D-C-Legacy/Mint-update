import type { Order as PrismaOrder } from '@prisma/client';
import { Order } from '../../domain/entities/order.entity';

export function toDomainOrder(row: PrismaOrder): Order {
  return {
    id: row.id,
    saleId: row.saleId,
    buyerUserId: row.buyerUserId,
    sellerId: row.sellerId,
    status: row.status,
    currency: row.currency,
    itemAmount: row.itemAmount,
    shippingAmount: row.shippingAmount,
    taxAmount: row.taxAmount,
    totalAmount: row.totalAmount,
    commissionBps: row.commissionBps,
    commissionAmount: row.commissionAmount,
    sellerNetAmount: row.sellerNetAmount,
    shippingAddress: row.shippingAddress as Record<string, unknown>,
    carrier: row.carrier,
    trackingNumber: row.trackingNumber,
    shippedAt: row.shippedAt,
    deliveredAt: row.deliveredAt,
    deliveryConfirmedBy: row.deliveryConfirmedBy,
    cancelledAt: row.cancelledAt,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
