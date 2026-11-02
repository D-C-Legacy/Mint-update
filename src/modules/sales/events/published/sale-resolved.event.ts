import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';
import { SaleMode } from '../../domain/entities/sale.entity';

export const SALE_RESOLVED_EVENT = 'sale.resolved';
export const SALE_RESOLVED_VERSION = 1;

// 06-REALTIME-AND-CONCURRENCY.md §6 step 6 — consumed by `orders` (P6-02, creates the Order)
// and by whichever ticket builds the SalesGateway's actual `sale.resolved` WS emission
// (`{saleId, winnerName, finalAmount}` per §2 — `winnerName` isn't resolved here, that's a
// cross-module display-name lookup belonging to the WS layer, not this event).
// `quantity` added in P6-02: the doc's own payload sketch never specified this event's exact
// shape (only the outbound WS `sale.resolved` shape, a different, smaller thing), and order
// creation needs it to convert the right number of reserved units to sold.
export interface SaleResolvedPayload {
  readonly saleId: string;
  readonly sessionId: string;
  readonly sellerId: string;
  readonly productId: string;
  readonly mode: SaleMode;
  readonly currency: string;
  readonly winnerUserId: string;
  readonly finalAmount: string; // minor units, as a string — BigInt is not JSON-serializable
  readonly quantity: number;
  readonly resolvedAt: string; // ISO 8601
}

export function saleResolvedEvent(payload: SaleResolvedPayload): DomainEvent<SaleResolvedPayload> {
  return createDomainEvent(SALE_RESOLVED_EVENT, SALE_RESOLVED_VERSION, payload);
}
