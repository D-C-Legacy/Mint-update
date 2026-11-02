import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const NOTIFICATION_CREATED_EVENT = 'notification.created';
export const NOTIFICATION_CREATED_VERSION = 1;

// Not documented anywhere (06-REALTIME-AND-CONCURRENCY.md's event catalogue has no notification
// events at all) — added for the Phase 6 app-integration inbox so a new notification can push live
// instead of waiting for the next poll. Published only for the EMAIL delivery of a given notify()
// call (see NotificationsService.notify): that's the one channel guaranteed to be created exactly
// once per user per logical event, same dedup reasoning as NotificationRepositoryPort.listForUser.
export interface NotificationCreatedPayload {
  readonly id: string;
  readonly userId: string;
  readonly templateKey: string;
  readonly content: Record<string, unknown>;
  readonly createdAt: string;
  // Generic structured reference for deep-linking: { type: 'order'|'stream'|'message'; id: string }
  readonly ref?: { type: string; id: string };
}

export function notificationCreatedEvent(
  payload: NotificationCreatedPayload,
): DomainEvent<NotificationCreatedPayload> {
  return createDomainEvent(NOTIFICATION_CREATED_EVENT, NOTIFICATION_CREATED_VERSION, payload);
}
