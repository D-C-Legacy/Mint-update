import { api } from "./index";
import type { Page } from "./catalog";
import type { OrderStatus, OrderView } from "./orders";

// GET /v1/seller/orders, POST /v1/orders/:id/ship (05-API-SPEC.md §8) — the seller's own order
// queue, not the buyer's. Same OrderView shape (buyer and seller see the same fields today).
export function listSellerOrders(filter: { status?: OrderStatus; cursor?: string; limit?: number } = {}): Promise<Page<OrderView>> {
  return api.request<Page<OrderView>>("/seller/orders", { query: { ...filter } });
}

export function shipOrder(orderId: string, input: { carrier: string; trackingNumber: string }): Promise<OrderView> {
  return api.request<OrderView>(`/orders/${encodeURIComponent(orderId)}/ship`, { method: "POST", body: input });
}
