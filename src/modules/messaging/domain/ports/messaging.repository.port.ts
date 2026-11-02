import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';

export const MESSAGING_REPOSITORY = Symbol('MessagingRepositoryPort');

export interface FindOrCreateConversationInput {
  readonly id: string;
  readonly buyerUserId: string;
  readonly sellerId: string;
}

export interface CreateMessageInput {
  readonly id: string;
  readonly conversationId: string;
  readonly senderUserId: string;
  readonly body: string;
  /** Which side's unread flag to flip — the side that did NOT send this message. */
  readonly markUnreadForSeller: boolean;
}

export interface ListConversationsFilter {
  readonly buyerUserId: string;
  readonly sellerId: string | null;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface ListMessagesFilter {
  readonly conversationId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface MessagingRepositoryPort {
  findOrCreateConversation(input: FindOrCreateConversationInput): Promise<Conversation>;
  findConversationById(id: string): Promise<Conversation | null>;
  /** Every conversation where the user is the buyer, OR (if they're a seller) the seller. */
  listConversationsForUser(filter: ListConversationsFilter): Promise<Conversation[]>;
  createMessage(input: CreateMessageInput): Promise<Message>;
  listMessages(filter: ListMessagesFilter): Promise<Message[]>;
  markRead(conversationId: string, side: 'BUYER' | 'SELLER'): Promise<Conversation | null>;
  findMessageById(id: string): Promise<Message | null>;
  deleteMessage(id: string): Promise<boolean>;
}
