import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateDeliveryInput,
  ListForUserFilter,
  NotificationRepositoryPort,
  UpdateDeliveryOutcomeInput,
} from '../../domain/ports/notification.repository.port';
import { NotificationDelivery } from '../../domain/entities/notification-delivery.entity';
import { toDomainNotificationDelivery } from '../mappers/notification-delivery.mapper';

@Injectable()
export class NotificationPrismaRepository implements NotificationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createDelivery(input: CreateDeliveryInput): Promise<NotificationDelivery> {
    const row = await this.prisma.notificationDelivery.create({
      data: {
        id: input.id,
        userId: input.userId,
        channel: input.channel,
        templateKey: input.templateKey,
        recipient: input.recipient,
        content: input.content as Prisma.InputJsonValue,
      },
    });
    return toDomainNotificationDelivery(row);
  }

  async updateDeliveryOutcome(
    id: string,
    input: UpdateDeliveryOutcomeInput,
  ): Promise<NotificationDelivery> {
    const row = await this.prisma.notificationDelivery.update({
      where: { id },
      data: {
        status: input.status,
        providerMessageId: input.providerMessageId,
        failureReason: input.failureReason,
        sentAt: input.sentAt,
      },
    });
    return toDomainNotificationDelivery(row);
  }

  async findDeliveryById(id: string): Promise<NotificationDelivery | null> {
    const row = await this.prisma.notificationDelivery.findUnique({ where: { id } });
    return row ? toDomainNotificationDelivery(row) : null;
  }

  async listDeliveriesForUser(userId: string, limit: number): Promise<NotificationDelivery[]> {
    const rows = await this.prisma.notificationDelivery.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toDomainNotificationDelivery);
  }

  async listForUser(filter: ListForUserFilter): Promise<NotificationDelivery[]> {
    const rows = await this.prisma.notificationDelivery.findMany({
      where: { userId: filter.userId, channel: 'EMAIL', deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainNotificationDelivery);
  }

  async countUnreadForUser(userId: string): Promise<number> {
    return this.prisma.notificationDelivery.count({
      where: { userId, channel: 'EMAIL', readAt: null, deletedAt: null },
    });
  }

  async markRead(id: string, userId: string): Promise<NotificationDelivery | null> {
    const { count } = await this.prisma.notificationDelivery.updateMany({
      where: { id, userId, channel: 'EMAIL', readAt: null, deletedAt: null },
      data: { readAt: new Date() },
    });
    if (count === 0) {
      // Either it doesn't exist/isn't this user's (not found), or it was already read (idempotent
      // — the caller re-reads below so an already-read row still returns its current state).
      const existing = await this.prisma.notificationDelivery.findFirst({
        where: { id, userId, channel: 'EMAIL', deletedAt: null },
      });
      return existing ? toDomainNotificationDelivery(existing) : null;
    }
    const row = await this.prisma.notificationDelivery.findUniqueOrThrow({ where: { id } });
    return toDomainNotificationDelivery(row);
  }

  async markAllRead(userId: string): Promise<number> {
    const { count } = await this.prisma.notificationDelivery.updateMany({
      where: { userId, channel: 'EMAIL', readAt: null, deletedAt: null },
      data: { readAt: new Date() },
    });
    return count;
  }

  async deleteNotification(id: string, userId: string): Promise<NotificationDelivery | null> {
    const { count } = await this.prisma.notificationDelivery.updateMany({
      where: { id, userId, channel: 'EMAIL', deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) {
      // A foreign id and an already-deleted id both land here and both read as NOT_FOUND — a
      // deleted row is out of this user's world entirely (see deleteNotification's port comment).
      return null;
    }
    const row = await this.prisma.notificationDelivery.findUniqueOrThrow({ where: { id } });
    return toDomainNotificationDelivery(row);
  }
}
