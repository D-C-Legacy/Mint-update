import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const ORDER_DELIVERED_EVENT = 'order.delivered';
export const ORDER_DELIVERED_VERSION = 1;

// 07-IMPLEMENTATION-PLAN.md's P6-08 deliverable: "emits order.delivered.v1". Published from
// ConfirmDeliveryUseCase, the use case that actually flips Order.status — same precedent as
// order.paid.v1/sale.resolved.v1. 00-PRD.md §4.4 step 4 ("the seller's balance moves from
// pending to available") is this event's eventual consumer — likely P7-05 ("Release on
// delivery"), unowned by name in the 65 tickets today.
export interface OrderDeliveredPayload {
  readonly orderId: string;
  readonly sellerId: string;
  readonly buyerUserId: string;
  readonly deliveredAt: string; // ISO 8601
  readonly confirmedBy: 'BUYER' | 'AUTO' | 'ADMIN';
}

export function orderDeliveredEvent(payload: OrderDeliveredPayload): DomainEvent<OrderDeliveredPayload> {
  return createDomainEvent(ORDER_DELIVERED_EVENT, ORDER_DELIVERED_VERSION, payload);
}
