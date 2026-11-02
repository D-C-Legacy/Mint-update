import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateMessageInput,
  FindOrCreateConversationInput,
  ListConversationsFilter,
  ListMessagesFilter,
  MessagingRepositoryPort,
} from '../../domain/ports/messaging.repository.port';
import { Conversation } from '../../domain/entities/conversation.entity';
import { Message } from '../../domain/entities/message.entity';
import { toDomainConversation } from '../mappers/conversation.mapper';
import { toDomainMessage } from '../mappers/message.mapper';

@Injectable()
export class MessagingPrismaRepository implements MessagingRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateConversation(input: FindOrCreateConversationInput): Promise<Conversation> {
    const row = await this.prisma.conversation.upsert({
      where: { buyerUserId_sellerId: { buyerUserId: input.buyerUserId, sellerId: input.sellerId } },
      update: {},
      create: { id: input.id, buyerUserId: input.buyerUserId, sellerId: input.sellerId },
    });
    return toDomainConversation(row);
  }

  async findConversationById(id: string): Promise<Conversation | null> {
    const row = await this.prisma.conversation.findUnique({ where: { id } });
    return row ? toDomainConversation(row) : null;
  }

  async listConversationsForUser(filter: ListConversationsFilter): Promise<Conversation[]> {
    const rows = await this.prisma.conversation.findMany({
      where: {
        OR: [{ buyerUserId: filter.buyerUserId }, ...(filter.sellerId ? [{ sellerId: filter.sellerId }] : [])],
      },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainConversation);
  }

  // One round trip: the message row plus the conversation's denormalized preview/unread flag,
  // consistent with each other by construction (unlike Order's own two-sequential-writes
  // precedent, a mismatch here would show a stale inbox preview, not just a thin audit gap).
  async createMessage(input: CreateMessageInput): Promise<Message> {
    const [messageRow] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { id: input.id, conversationId: input.conversationId, senderUserId: input.senderUserId, body: input.body },
      }),
      this.prisma.conversation.update({
        where: { id: input.conversationId },
        data: {
          lastMessageAt: new Date(),
          lastMessageBody: input.body,
          ...(input.markUnreadForSeller ? { sellerUnread: true } : { buyerUnread: true }),
        },
      }),
    ]);
    return toDomainMessage(messageRow);
  }

  async listMessages(filter: ListMessagesFilter): Promise<Message[]> {
    const rows = await this.prisma.message.findMany({
      where: { conversationId: filter.conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainMessage);
  }

  async markRead(conversationId: string, side: 'BUYER' | 'SELLER'): Promise<Conversation | null> {
    const { count } = await this.prisma.conversation.updateMany({
      where: { id: conversationId },
      data: side === 'BUYER' ? { buyerUnread: false } : { sellerUnread: false },
    });
    if (count === 0) return null;
    return this.findConversationById(conversationId);
  }

  async findMessageById(id: string): Promise<Message | null> {
    const row = await this.prisma.message.findUnique({ where: { id } });
    return row ? toDomainMessage(row) : null;
  }

  async deleteMessage(id: string): Promise<boolean> {
    const { count } = await this.prisma.message.deleteMany({ where: { id } });
    return count > 0;
  }
}
