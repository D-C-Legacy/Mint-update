import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const ORDER_SHIPPED_EVENT = 'order.shipped';
export const ORDER_SHIPPED_VERSION = 1;

// Added for P8-04 ("order shipped" is one of the 6 deliverables) — ShipOrderUseCase never
// published anything before this (only confirm-delivery/mark-order-paid did).
export interface OrderShippedPayload {
  readonly orderId: string;
  readonly buyerUserId: string;
  readonly carrier: string;
  readonly trackingNumber: string;
}

export function orderShippedEvent(payload: OrderShippedPayload): DomainEvent<OrderShippedPayload> {
  return createDomainEvent(ORDER_SHIPPED_EVENT, ORDER_SHIPPED_VERSION, payload);
}
