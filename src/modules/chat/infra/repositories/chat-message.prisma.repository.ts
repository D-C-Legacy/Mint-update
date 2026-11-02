import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  ChatMessageRepositoryPort,
  UpsertChatMessageInput,
} from '../../domain/ports/chat-message.repository.port';
import { ChatMessage } from '../../domain/entities/chat-message.entity';
import { toDomainChatMessage } from '../mappers/chat-message.mapper';

@Injectable()
export class ChatMessagePrismaRepository implements ChatMessageRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: UpsertChatMessageInput): Promise<ChatMessage> {
    const row = await this.prisma.chatMessage.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        sessionId: input.sessionId,
        userId: input.userId,
        body: input.body,
        type: input.type,
        createdAt: input.createdAt,
      },
      update: {},
    });
    return toDomainChatMessage(row);
  }

  async findById(id: string): Promise<ChatMessage | null> {
    const row = await this.prisma.chatMessage.findUnique({ where: { id } });
    return row ? toDomainChatMessage(row) : null;
  }

  async markDeleted(id: string, deletedByUserId: string): Promise<ChatMessage> {
    const row = await this.prisma.chatMessage.update({
      where: { id },
      data: { isDeleted: true, deletedByUserId },
    });
    return toDomainChatMessage(row);
  }
}
