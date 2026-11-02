import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const SELLER_REJECTED_EVENT = 'seller.rejected';
export const SELLER_REJECTED_VERSION = 1;

// Mirrors seller-approved.event.ts — added for P8-04, which needs both halves of "application
// decided" to notify the applicant either way. RejectApplicationUseCase never published anything
// before this (confirmed: ApproveApplicationUseCase was the only one of the two wired to EVENT_BUS).
export interface SellerRejectedPayload {
  readonly sellerId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly reason: string;
}

export function sellerRejectedEvent(payload: SellerRejectedPayload): DomainEvent<SellerRejectedPayload> {
  return createDomainEvent(SELLER_REJECTED_EVENT, SELLER_REJECTED_VERSION, payload);
}
