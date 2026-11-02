import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateModeratorInput,
  ListModeratorsFilter,
  StreamModeratorRepositoryPort,
} from '../../domain/ports/stream-moderation.repository.port';
import { StreamModerator } from '../../domain/entities/stream-moderation.entity';
import { toDomainStreamModerator } from '../mappers/stream-moderation.mapper';

@Injectable()
export class StreamModeratorPrismaRepository implements StreamModeratorRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<StreamModerator | null> {
    const row = await this.prisma.streamModerator.findUnique({ where: { id } });
    return row ? toDomainStreamModerator(row) : null;
  }

  async findBySessionIdAndUserId(
    sessionId: string,
    userId: string,
  ): Promise<StreamModerator | null> {
    const row = await this.prisma.streamModerator.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
    return row ? toDomainStreamModerator(row) : null;
  }

  async findByUserId(userId: string): Promise<StreamModerator[]> {
    const rows = await this.prisma.streamModerator.findMany({
      where: { userId },
    });
    return rows.map(toDomainStreamModerator);
  }

  async create(input: CreateModeratorInput): Promise<StreamModerator> {
    const row = await this.prisma.streamModerator.create({
      data: {
        id: input.id,
        sessionId: input.sessionId,
        userId: input.userId,
        addedBy: input.addedBy,
        role: input.role,
      },
    });
    return toDomainStreamModerator(row);
  }

  async delete(moderatorId: string): Promise<void> {
    await this.prisma.streamModerator.delete({ where: { id: moderatorId } });
  }

  async list(filter: ListModeratorsFilter): Promise<StreamModerator[]> {
    const rows = await this.prisma.streamModerator.findMany({
      where: { sessionId: filter.sessionId },
      take: filter.limit + 1,
      orderBy: { createdAt: 'desc' },
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainStreamModerator);
  }
}
