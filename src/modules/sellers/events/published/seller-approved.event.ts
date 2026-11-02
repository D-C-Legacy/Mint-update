import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const SELLER_APPROVED_EVENT = 'seller.approved';
export const SELLER_APPROVED_VERSION = 1;

export interface SellerApprovedPayload {
  readonly sellerId: string;
  readonly userId: string;
  readonly displayName: string;
}

export function sellerApprovedEvent(payload: SellerApprovedPayload): DomainEvent<SellerApprovedPayload> {
  return createDomainEvent(SELLER_APPROVED_EVENT, SELLER_APPROVED_VERSION, payload);
}
