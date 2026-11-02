import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateTimeoutInput,
  ListTimeoutsFilter,
  ChatTimeoutRepositoryPort,
} from '../../domain/ports/stream-moderation.repository.port';
import { ChatTimeout } from '../../domain/entities/stream-moderation.entity';
import { toDomainChatTimeout } from '../mappers/stream-moderation.mapper';

@Injectable()
export class ChatTimeoutPrismaRepository implements ChatTimeoutRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ChatTimeout | null> {
    const row = await this.prisma.chatTimeout.findUnique({ where: { id } });
    return row ? toDomainChatTimeout(row) : null;
  }

  async findActiveBySessionIdAndUserId(
    sessionId: string,
    userId: string,
  ): Promise<ChatTimeout | null> {
    const row = await this.prisma.chatTimeout.findFirst({
      where: {
        sessionId,
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: 'desc' },
    });
    return row ? toDomainChatTimeout(row) : null;
  }

  async create(input: CreateTimeoutInput): Promise<ChatTimeout> {
    const row = await this.prisma.chatTimeout.create({
      data: {
        id: input.id,
        sessionId: input.sessionId,
        userId: input.userId,
        moderatorId: input.moderatorId,
        expiresAt: input.expiresAt,
        reason: input.reason,
      },
    });
    return toDomainChatTimeout(row);
  }

  async delete(expiredBefore: Date): Promise<number> {
    const { count } = await this.prisma.chatTimeout.deleteMany({
      where: { expiresAt: { lt: expiredBefore } },
    });
    return count;
  }

  async list(filter: ListTimeoutsFilter): Promise<ChatTimeout[]> {
    const rows = await this.prisma.chatTimeout.findMany({
      where: {
        sessionId: filter.sessionId,
        ...(filter.userId ? { userId: filter.userId } : {}),
        ...(filter.activeOnly ? { expiresAt: { gt: new Date() } } : {}),
      },
      take: filter.limit + 1,
      orderBy: { createdAt: 'desc' },
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainChatTimeout);
  }
}
