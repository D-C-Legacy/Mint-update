import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateQueueItemInput,
  ReorderInput,
  StreamQueueItemRepositoryPort,
} from '../../domain/ports/stream-queue-item.repository.port';
import { StreamQueueItem } from '../../domain/entities/stream-queue-item.entity';
import { toDomainStreamQueueItem } from '../mappers/stream-queue-item.mapper';

@Injectable()
export class StreamQueueItemPrismaRepository implements StreamQueueItemRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<StreamQueueItem | null> {
    const row = await this.prisma.streamQueueItem.findUnique({ where: { id } });
    return row ? toDomainStreamQueueItem(row) : null;
  }

  async listBySession(sessionId: string): Promise<StreamQueueItem[]> {
    const rows = await this.prisma.streamQueueItem.findMany({
      where: { sessionId },
      orderBy: { position: 'asc' },
    });
    return rows.map(toDomainStreamQueueItem);
  }

  async findActiveBySession(sessionId: string): Promise<StreamQueueItem | null> {
    const row = await this.prisma.streamQueueItem.findFirst({
      where: { sessionId, status: 'ACTIVE' },
    });
    return row ? toDomainStreamQueueItem(row) : null;
  }

  async create(input: CreateQueueItemInput): Promise<StreamQueueItem> {
    const row = await this.prisma.streamQueueItem.create({
      data: {
        id: input.id,
        sessionId: input.sessionId,
        productId: input.productId,
        position: input.position,
        mode: input.mode,
        startAmount: input.startAmount,
        price: input.price,
        quantity: input.quantity,
      },
    });
    return toDomainStreamQueueItem(row);
  }

  async reorder(items: readonly ReorderInput[]): Promise<void> {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.streamQueueItem.update({
          where: { id: item.id },
          data: { position: item.position },
        }),
      ),
    );
  }

  async markActive(id: string, saleId: string): Promise<StreamQueueItem> {
    const row = await this.prisma.streamQueueItem.update({
      where: { id },
      data: { status: 'ACTIVE', saleId },
    });
    return toDomainStreamQueueItem(row);
  }

  async markDone(id: string): Promise<StreamQueueItem> {
    const row = await this.prisma.streamQueueItem.update({
      where: { id },
      data: { status: 'DONE' },
    });
    return toDomainStreamQueueItem(row);
  }
}
