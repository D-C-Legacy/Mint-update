import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';
import { SaleMode } from '../../domain/entities/sale.entity';

export const SALE_MODE_SWITCHED_EVENT = 'sale.mode-switched';
export const SALE_MODE_SWITCHED_VERSION = 1;

// New with the live-streaming build-out, 14 Oct 2026 (founder_requests.md §1) — not in
// 06-REALTIME-AND-CONCURRENCY.md's original event catalogue, since mode switching didn't exist
// when that doc was written. Cross-process signal only, same split as bid-accepted.event.ts: this
// carries what SalesGateway needs to fan out `sale.mode-switched` to the room.
export interface SaleModeSwitchedPayload {
  readonly saleId: string;
  readonly sessionId: string;
  readonly mode: SaleMode;
  readonly currentAmount: string | null; // minor units, as a string — BigInt is not JSON-serializable
  readonly price: string | null;
  readonly endsAt: string | null; // ISO 8601
}

export function saleModeSwitchedEvent(
  payload: SaleModeSwitchedPayload,
): DomainEvent<SaleModeSwitchedPayload> {
  return createDomainEvent(SALE_MODE_SWITCHED_EVENT, SALE_MODE_SWITCHED_VERSION, payload);
}
