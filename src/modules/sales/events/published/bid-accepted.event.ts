import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const BID_ACCEPTED_EVENT = 'sale.bid-accepted';
export const BID_ACCEPTED_VERSION = 1;

// Cross-process signal only (06-REALTIME-AND-CONCURRENCY.md §3) — not the same thing as the
// `bid.accepted` WS outbound event name from §2. This one carries everything P5-09's
// SalesGateway needs to fan out to the right WS scopes/shapes (`sale.updated`, `sale.extended`,
// `bid.accepted` to the bidder, `bid.outbid` to the previous leader); it is not emitted to
// clients directly.
export interface BidAcceptedPayload {
  readonly saleId: string;
  readonly sessionId: string;
  readonly bidId: string;
  readonly bidderUserId: string;
  readonly clientRef: string;
  readonly amount: string; // minor units, as a string — BigInt is not JSON-serializable
  readonly sequence: number;
  readonly endsAt: string; // ISO 8601
  readonly extended: boolean;
  readonly extensionCount: number;
  readonly previousLeaderUserId: string | null;
}

export function bidAcceptedEvent(payload: BidAcceptedPayload): DomainEvent<BidAcceptedPayload> {
  return createDomainEvent(BID_ACCEPTED_EVENT, BID_ACCEPTED_VERSION, payload);
}
