import { NotificationDelivery } from '../../domain/entities/notification-delivery.entity';

// Shape for GET /v1/me/notifications and the mark-read response. `recipient` (a push token or
// email address) and provider/failure detail are internal — only what the inbox screen needs to
// render a row and track read state is exposed.
export interface NotificationView {
  readonly id: string;
  readonly templateKey: string;
  readonly content: Record<string, unknown>;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export function toNotificationView(delivery: NotificationDelivery): NotificationView {
  return {
    id: delivery.id,
    templateKey: delivery.templateKey,
    content: delivery.content,
    readAt: delivery.readAt ? delivery.readAt.toISOString() : null,
    createdAt: delivery.createdAt.toISOString(),
  };
}
