import { Message as PrismaMessage } from '@prisma/client';
import { Message } from '../../domain/entities/message.entity';

export function toDomainMessage(row: PrismaMessage): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderUserId: row.senderUserId,
    body: row.body,
    createdAt: row.createdAt,
  };
}
