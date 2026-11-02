import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const MESSAGE_CREATED_EVENT = 'message.created';
export const MESSAGE_CREATED_VERSION = 1;

// Not in 06-REALTIME-AND-CONCURRENCY.md's event catalogue — added for Phase 8 so a new DM pushes
// live, same per-user-channel precedent as notification.created/order.status.changed.
export interface MessageCreatedPayload {
  readonly conversationId: string;
  readonly messageId: string;
  readonly senderUserId: string;
  readonly recipientUserId: string;
  readonly body: string;
  readonly createdAt: string;
}

export function messageCreatedEvent(payload: MessageCreatedPayload): DomainEvent<MessageCreatedPayload> {
  return createDomainEvent(MESSAGE_CREATED_EVENT, MESSAGE_CREATED_VERSION, payload);
}
