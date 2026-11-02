import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const OFFER_SUBMITTED_EVENT = 'offer.submitted';
export const OFFER_SUBMITTED_VERSION = 1;

// Cross-process signal (06-REALTIME-AND-CONCURRENCY.md §3) — whichever ticket builds the
// SalesGateway consumes this to emit the documented `offer.received {offer}` WS event, scoped
// to the seller only (§2).
export interface OfferSubmittedPayload {
  readonly offerId: string;
  readonly saleId: string;
  readonly sessionId: string;
  readonly sellerId: string;
  readonly buyerUserId: string;
  readonly amount: string; // minor units, as a string
  readonly expiresAt: string; // ISO 8601
}

export function offerSubmittedEvent(payload: OfferSubmittedPayload): DomainEvent<OfferSubmittedPayload> {
  return createDomainEvent(OFFER_SUBMITTED_EVENT, OFFER_SUBMITTED_VERSION, payload);
}
