import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const ORDER_CANCELLED_EVENT = 'order.cancelled';
export const ORDER_CANCELLED_VERSION = 2;

// Added for the Phase 6 app-integration buyer cancel (CancelOrderUseCase) — no prior use case
// ever cancelled an order, so nothing published this before.
//
// Widened (v2) for the engineering-hardening backlog's seller/admin PAID-order cancel: carries
// enough for the payments and ledger modules to react (refund + ledger reversal) without a
// second DB round-trip, same "carries enough data to post without a round-trip" precedent as
// order-paid.event.ts's OrderPaidPayload. `wasPaid` gates both reactions — false for every
// buyer-path cancel (PENDING_PAYMENT only) and for a seller/admin cancel of a PENDING_PAYMENT
// order; true only when a seller/admin cancels an order that was PAID, which is the one case
// where money actually needs to move back.
export interface OrderCancelledPayload {
  readonly orderId: string;
  readonly buyerUserId: string;
  readonly sellerId: string;
  readonly reason: string | null;
  readonly cancelledByUserId: string;
  readonly wasPaid: boolean;
  readonly currency: string;
  readonly itemAmount: string; // minor units, as a string — BigInt is not JSON-serializable
  readonly commissionAmount: string;
  readonly sellerNetAmount: string;
}

export function orderCancelledEvent(
  payload: OrderCancelledPayload,
): DomainEvent<OrderCancelledPayload> {
  return createDomainEvent(ORDER_CANCELLED_EVENT, ORDER_CANCELLED_VERSION, payload);
}
