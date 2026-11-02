import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const CHAT_MESSAGE_DELETED_EVENT = 'chat.message-deleted';
export const CHAT_MESSAGE_DELETED_VERSION = 1;

export interface ChatMessageDeletedPayload {
  readonly sessionId: string;
  readonly messageId: string;
}

export function chatMessageDeletedEvent(
  payload: ChatMessageDeletedPayload,
): DomainEvent<ChatMessageDeletedPayload> {
  return createDomainEvent(CHAT_MESSAGE_DELETED_EVENT, CHAT_MESSAGE_DELETED_VERSION, payload);
}
