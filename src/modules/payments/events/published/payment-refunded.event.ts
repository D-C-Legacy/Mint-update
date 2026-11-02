import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const PAYMENT_REFUNDED_EVENT = 'payment.refunded';
export const PAYMENT_REFUNDED_VERSION = 1;

// Engineering backlog Phase 3b: the money side of a refund, published by whichever
// payments use case created or settled the Refund row (execute(), reconcileRefunds()) —
// NOT by refundForCancelledOrder, because a PAID-order cancel already booked its full
// reversal through order.cancelled (OnOrderCancelledHandler in the ledger module), and
// emitting here too would credit PLATFORM_CASH twice for one money movement. Dashboard-made
// refunds and late-settling in-app ones arrive here via the charge.refunded /
// charge.refund.updated webhook path (reconcileRefunds), deduped ledger-side by
// `refund.recorded:<providerRefundId>` — the Stripe id is globally unique to the actual money
// movement, unlike the local Refund row id (a dashboard-created row and an app-created one
// for the same refund could in principle differ locally; they can never differ on Stripe's id).
//
// Carries enough to post the ledger transaction without a second DB round-trip, same
// convention as order-paid.event.ts / order-cancelled.event.ts: the order's own order.paid
// composition (itemAmount/commissionAmount/sellerNetAmount) plus the refund amount, so the
// ledger's proportional-split rule has everything it needs.
export interface PaymentRefundedPayload {
  readonly refundId: string; // local Refund row id (record-keeping)
  readonly providerRefundId: string; // Stripe's own refund id — the idempotency anchor
  readonly paymentId: string;
  readonly orderId: string;
  readonly sellerId: string;
  readonly currency: string;
  readonly refundAmount: string; // minor units, as a string — BigInt is not JSON-serializable
  readonly itemAmount: string;
  readonly commissionAmount: string;
  readonly sellerNetAmount: string;
  readonly refundedAt: string; // ISO 8601
}

export function paymentRefundedEvent(
  payload: PaymentRefundedPayload,
): DomainEvent<PaymentRefundedPayload> {
  return createDomainEvent(PAYMENT_REFUNDED_EVENT, PAYMENT_REFUNDED_VERSION, payload);
}
