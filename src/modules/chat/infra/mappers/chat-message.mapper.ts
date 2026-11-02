import type { ChatMessage as PrismaChatMessage } from '@prisma/client';
import { ChatMessage } from '../../domain/entities/chat-message.entity';

export function toDomainChatMessage(row: PrismaChatMessage): ChatMessage {
  return {
    id: row.id,
    sessionId: row.sessionId,
    userId: row.userId,
    body: row.body,
    type: row.type,
    isDeleted: row.isDeleted,
    deletedByUserId: row.deletedByUserId,
    createdAt: row.createdAt,
  };
}
