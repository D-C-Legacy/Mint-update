import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const SALE_CANCELLED_EVENT = 'sale.cancelled';
export const SALE_CANCELLED_VERSION = 1;

// 06-REALTIME-AND-CONCURRENCY.md §6 step 4: an auction that closed with no bids sets
// Sale.status to EXPIRED, but reuses this same `sale.cancelled` WS event name (§2 has no
// separate "expired" outbound event) — the `reason` field is what distinguishes them.
export interface SaleCancelledPayload {
  readonly saleId: string;
  readonly sessionId: string;
  readonly reason: string;
  readonly resolvedAt: string; // ISO 8601
}

export function saleCancelledEvent(payload: SaleCancelledPayload): DomainEvent<SaleCancelledPayload> {
  return createDomainEvent(SALE_CANCELLED_EVENT, SALE_CANCELLED_VERSION, payload);
}
