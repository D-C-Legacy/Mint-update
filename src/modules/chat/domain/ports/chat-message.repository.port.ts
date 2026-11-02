import { ChatMessage, ChatMessageType } from '../entities/chat-message.entity';

export const CHAT_MESSAGE_REPOSITORY = Symbol('ChatMessageRepositoryPort');

export interface UpsertChatMessageInput {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly body: string;
  readonly type: ChatMessageType;
  readonly createdAt: Date;
}

export interface ChatMessageRepositoryPort {
  /** Keyed on `id` (client/server-generated before enqueueing) so the async persist job
   * (06-REALTIME-AND-CONCURRENCY.md §9: "write to Postgres asynchronously via a queue") stays
   * safe under BullMQ's at-least-once delivery — a retried job upserts the same row, never
   * duplicates it. */
  upsert(input: UpsertChatMessageInput): Promise<ChatMessage>;
  findById(id: string): Promise<ChatMessage | null>;
  markDeleted(id: string, deletedByUserId: string): Promise<ChatMessage>;
}
