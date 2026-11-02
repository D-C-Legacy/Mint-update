// Typed wrappers around the admin orders routes. Shape mirrors the backend's full `Order`
// entity (src/modules/orders/domain/entities/order.entity.ts) — the admin routes return it
// unsanitized (same as the existing GET /admin/orders list), unlike the buyer/seller-facing
// OrderView which hides commissionAmount/sellerNetAmount/deliveryConfirmedBy. Money fields
// arrive as plain numbers (minor units) via the backend's BigInt.prototype.toJSON polyfill.
import { apiClient } from '../auth/AuthContext';
import type { CursorPage } from './applications';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'DISPUTED';

export type DeliveryConfirmationSource = 'CARRIER' | 'BUYER' | 'AUTO' | 'ADMIN';

export type Order = {
  id: string;
  saleId: string;
  buyerUserId: string;
  sellerId: string;
  status: OrderStatus;
  currency: string;
  itemAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  commissionBps: number;
  commissionAmount: number;
  sellerNetAmount: number;
  shippingAddress: Record<string, unknown>;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  deliveryConfirmedBy: DeliveryConfirmationSource | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export function listOrders(params: { status?: OrderStatus; cursor?: string }): Promise<CursorPage<Order>> {
  return apiClient.request('/admin/orders', {
    query: { status: params.status, cursor: params.cursor, limit: 20 },
  });
}

export function getOrder(orderId: string): Promise<Order> {
  return apiClient.request(`/admin/orders/${orderId}`);
}

export function refundOrder(
  orderId: string,
  amountMinorUnits: number,
  reason: string,
): Promise<{ refundId: string; paymentStatus: string; orderStatus: string }> {
  return apiClient.request(`/admin/orders/${orderId}/refund`, {
    method: 'POST',
    idempotent: true,
    body: { amount: amountMinorUnits, reason },
  });
}

export function forceDeliverOrder(orderId: string): Promise<Order> {
  return apiClient.request(`/admin/orders/${orderId}/force-deliver`, { method: 'POST' });
}
