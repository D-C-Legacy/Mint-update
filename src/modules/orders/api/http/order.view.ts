import { Order } from '../../domain/entities/order.entity';

// Shape for GET /v1/orders and GET /v1/orders/:id. Money is integer minor units (a plain number).
// Hidden: commissionAmount and sellerNetAmount (the platform's and seller's split), and
// deliveryConfirmedBy (internal). Both buyer and seller see this shape for now.
export interface OrderView {
  readonly id: string;
  readonly saleId: string;
  readonly sellerId: string;
  readonly status: string;
  readonly currency: string;
  readonly itemAmount: number;
  readonly shippingAmount: number;
  readonly taxAmount: number;
  readonly totalAmount: number;
  readonly shippingAddress: Record<string, unknown>;
  readonly carrier: string | null;
  readonly trackingNumber: string | null;
  readonly shippedAt: string | null;
  readonly deliveredAt: string | null;
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
  readonly createdAt: string;
}

export function toOrderView(order: Order): OrderView {
  return {
    id: order.id,
    saleId: order.saleId,
    sellerId: order.sellerId,
    status: order.status,
    currency: order.currency,
    itemAmount: Number(order.itemAmount),
    shippingAmount: Number(order.shippingAmount),
    taxAmount: Number(order.taxAmount),
    totalAmount: Number(order.totalAmount),
    shippingAddress: order.shippingAddress,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    shippedAt: order.shippedAt ? order.shippedAt.toISOString() : null,
    deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
    cancelledAt: order.cancelledAt ? order.cancelledAt.toISOString() : null,
    cancelReason: order.cancelReason,
    createdAt: order.createdAt.toISOString(),
  };
}
