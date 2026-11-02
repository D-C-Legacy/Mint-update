import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const ORDER_PAID_EVENT = 'order.paid';
// v2 (3b): payload gained providerFeeMinor — the processor fee payments recorded on the
// Payment row, so the ledger's posting can include 03-DATA-MODEL.md §10's PROCESSOR_FEES /
// PLATFORM_CASH fee pair ('0' → no pair, the pre-v2 shape). Handlers read with ?? '0' so a
// v1 event still in flight at deploy time stays valid.
export const ORDER_PAID_VERSION = 2;

// 07-IMPLEMENTATION-PLAN.md's P6-07 deliverable: "emits order.paid.v1". Published from
// MarkOrderPaidUseCase (the use case that actually flips Order.status), not from
// modules/payments' PayOrderUseCase — same precedent as sales publishing `sale.resolved.v1`
// from whichever use case owns the state transition, not from whichever caller triggered it.
// Carries enough data for P7-04 ("order-paid posting") to post the ledger transaction without a
// second DB round-trip, same reasoning as sale-resolved.event.ts.
export interface OrderPaidPayload {
  readonly orderId: string;
  readonly paymentId: string;
  readonly sellerId: string;
  readonly buyerUserId: string;
  readonly currency: string;
  readonly itemAmount: string; // minor units, as a string — BigInt is not JSON-serializable
  readonly commissionAmount: string;
  readonly sellerNetAmount: string;
  // v2: the processor fee (minor units as a string; '0' = unknown/not posted). Optional in
  // the TYPE so a v1 event still in flight at deploy time type-checks the same for readers.
  readonly providerFeeMinor?: string;
  readonly paidAt: string; // ISO 8601
}

export function orderPaidEvent(payload: OrderPaidPayload): DomainEvent<OrderPaidPayload> {
  return createDomainEvent(ORDER_PAID_EVENT, ORDER_PAID_VERSION, payload);
}
