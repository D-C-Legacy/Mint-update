import { Conversation as PrismaConversation } from '@prisma/client';
import { Conversation } from '../../domain/entities/conversation.entity';

export function toDomainConversation(row: PrismaConversation): Conversation {
  return {
    id: row.id,
    buyerUserId: row.buyerUserId,
    sellerId: row.sellerId,
    lastMessageAt: row.lastMessageAt,
    lastMessageBody: row.lastMessageBody,
    buyerUnread: row.buyerUnread,
    sellerUnread: row.sellerUnread,
    createdAt: row.createdAt,
  };
}
