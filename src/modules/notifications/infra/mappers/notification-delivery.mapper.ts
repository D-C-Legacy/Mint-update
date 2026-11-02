import type { NotificationDelivery as PrismaNotificationDelivery } from '@prisma/client';
import { NotificationDelivery } from '../../domain/entities/notification-delivery.entity';

export function toDomainNotificationDelivery(
  row: PrismaNotificationDelivery,
): NotificationDelivery {
  return {
    id: row.id,
    userId: row.userId,
    channel: row.channel,
    templateKey: row.templateKey,
    recipient: row.recipient,
    content: row.content as Record<string, unknown>,
    status: row.status,
    providerMessageId: row.providerMessageId,
    failureReason: row.failureReason,
    sentAt: row.sentAt,
    readAt: row.readAt,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
  };
}
