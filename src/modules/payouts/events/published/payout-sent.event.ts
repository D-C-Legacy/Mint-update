import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const PAYOUT_SENT_EVENT = 'payout.sent';
export const PAYOUT_SENT_VERSION = 1;

// Added for P8-04 ("payout sent" is one of the 6 deliverables) — distinct from the ledger's own
// internal `type: 'payout.sent'` transaction-type string (LedgerService.post, same literal name
// but a different system entirely, never dispatched over EVENT_BUS). Nothing in this module
// published a domain event before this.
export interface PayoutSentPayload {
  readonly payoutId: string;
  readonly sellerId: string; // Seller.id, established convention — not a User.id
  readonly amount: string; // minor units, as a string — BigInt is not JSON-serializable
  readonly currency: string;
}

export function payoutSentEvent(payload: PayoutSentPayload): DomainEvent<PayoutSentPayload> {
  return createDomainEvent(PAYOUT_SENT_EVENT, PAYOUT_SENT_VERSION, payload);
}
