import { api } from "./index";
import type { Page } from "./catalog";
import { withoutNullLine2, type AddressFields } from "./addresses";

// The buyer's view of an order (05-API-SPEC.md §8). Money is integer minor units.
export type OrderView = {
  id: string;
  saleId: string;
  sellerId: string;
  status: OrderStatus;
  currency: string;
  itemAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  shippingAddress: Record<string, unknown>;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
};

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED"
  | "DISPUTED";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Waiting for payment",
  PAID: "Paid",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  DISPUTED: "Disputed",
};

// Cents to dollars, for display only.
export function dollars(minor: number): string {
  return `$${(minor / 100).toFixed(2)}`;
}

export function listMyOrders(cursor?: string): Promise<Page<OrderView>> {
  return api.request<Page<OrderView>>("/orders", { query: { limit: 20, cursor } });
}

// POST /v1/orders/:id/address: sets or replaces the order's own copy of the address (allowed while
// the order is waiting for payment or paid, before it ships). Saved addresses are not linked.
export function setOrderAddress(orderId: string, address: AddressFields): Promise<OrderView> {
  return api.request<OrderView>(`/orders/${encodeURIComponent(orderId)}/address`, {
    method: "POST",
    body: withoutNullLine2(address),
  });
}

export function getMyOrder(orderId: string): Promise<OrderView> {
  return api.request<OrderView>(`/orders/${encodeURIComponent(orderId)}`);
}

export function confirmDelivery(orderId: string): Promise<OrderView> {
  return api.request<OrderView>(`/orders/${encodeURIComponent(orderId)}/confirm-delivery`, { method: "POST" });
}

// POST /v1/orders/:id/cancel, buyer path (not in 05-API-SPEC.md as a buyer action — see
// cancel-order.usecase.ts). Only works while the order is still waiting for payment.
export function cancelOrder(orderId: string, reason?: string): Promise<OrderView> {
  return api.request<OrderView>(`/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}
