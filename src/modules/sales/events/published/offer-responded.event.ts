import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';
import { OfferStatus } from '../../domain/entities/offer.entity';

export const OFFER_RESPONDED_EVENT = 'offer.responded';
export const OFFER_RESPONDED_VERSION = 1;

// Matches the documented `offer.responded {offerId, status, counterAmount}` WS event (§2),
// scoped to the offering buyer only. Covers all three seller responses (accept/reject/counter)
// — on accept, `sale-resolved.event.ts` is ALSO published separately for the room-wide broadcast.
export interface OfferRespondedPayload {
  readonly offerId: string;
  readonly saleId: string;
  readonly buyerUserId: string;
  readonly status: OfferStatus;
  readonly counterAmount: string | null; // minor units, as a string
}

export function offerRespondedEvent(payload: OfferRespondedPayload): DomainEvent<OfferRespondedPayload> {
  return createDomainEvent(OFFER_RESPONDED_EVENT, OFFER_RESPONDED_VERSION, payload);
}
