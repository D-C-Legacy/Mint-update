import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const QUEUE_ITEM_FEATURED_EVENT = 'queue.item-featured';
export const QUEUE_ITEM_FEATURED_VERSION = 1;

// New with the live-streaming build-out, 14 Oct 2026 (founder_requests.md §2/§3) — not in
// 06-REALTIME-AND-CONCURRENCY.md's original catalogue. Drives the viewer-facing current-item
// banner: whichever gateway handles this broadcasts `queue.item-featured` to the room.
export interface QueueItemFeaturedPayload {
  readonly sessionId: string;
  readonly itemId: string;
  readonly productId: string;
  readonly saleId: string;
}

export function queueItemFeaturedEvent(
  payload: QueueItemFeaturedPayload,
): DomainEvent<QueueItemFeaturedPayload> {
  return createDomainEvent(QUEUE_ITEM_FEATURED_EVENT, QUEUE_ITEM_FEATURED_VERSION, payload);
}
