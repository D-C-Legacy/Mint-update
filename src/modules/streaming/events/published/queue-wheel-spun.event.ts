import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';
import { QueueItemMode } from '../../domain/entities/stream-queue-item.entity';

export const QUEUE_WHEEL_SPUN_EVENT = 'queue.wheel-spun';
export const QUEUE_WHEEL_SPUN_VERSION = 1;

// New 21 Oct 2026 (founder "spin the wheel" request) — not in 06-REALTIME-AND-CONCURRENCY.md's
// catalogue, same ad hoc addition queue-item-featured.event.ts already got away with (see that
// file's own comment). Broadcast the instant the server picks an item, before any Sale exists —
// SpinQueueWheelUseCase reads + picks + broadcasts only, it writes nothing. The seller's own client
// reacts by opening the existing "Feature" sheet pre-filled with this item; viewers just play a
// landing animation. The real `queue.item-featured` event (unchanged) follows once the seller
// actually confirms terms.
export interface QueueWheelSpunPayload {
  readonly sessionId: string;
  readonly itemId: string;
  readonly productId: string;
  readonly mode: QueueItemMode;
}

export function queueWheelSpunEvent(
  payload: QueueWheelSpunPayload,
): DomainEvent<QueueWheelSpunPayload> {
  return createDomainEvent(QUEUE_WHEEL_SPUN_EVENT, QUEUE_WHEEL_SPUN_VERSION, payload);
}
