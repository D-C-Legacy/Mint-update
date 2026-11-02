import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';

export class ConversationNotFoundError extends DomainError {
  readonly code = ErrorCodes.NOT_FOUND;

  constructor(conversationId: string) {
    super(`Conversation ${conversationId} not found`, { conversationId });
  }
}

export class MessageNotFoundError extends DomainError {
  readonly code = ErrorCodes.NOT_FOUND;

  constructor(messageId: string) {
    super(`Message ${messageId} not found`, { messageId });
  }
}

// A buyer trying to open a conversation with their own seller account — not a real use case,
// and letting it through would create a conversation with buyerUserId === the seller's own
// user, which every "who's the other party" display in the app would render nonsensically.
export class SellerCannotMessageSelfError extends DomainError {
  readonly code = ErrorCodes.SELLER_CANNOT_MESSAGE_SELF;

  constructor() {
    super('A seller cannot start a conversation with their own account');
  }
}
