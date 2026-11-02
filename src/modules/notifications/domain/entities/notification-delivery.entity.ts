export type NotificationChannel = 'PUSH' | 'EMAIL';
export type NotificationDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface NotificationDelivery {
  readonly id: string;
  readonly userId: string;
  readonly channel: NotificationChannel;
  readonly templateKey: string;
  readonly recipient: string;
  readonly content: Record<string, unknown>;
  readonly status: NotificationDeliveryStatus;
  readonly providerMessageId: string | null;
  readonly failureReason: string | null;
  readonly sentAt: Date | null;
  readonly readAt: Date | null;
  readonly deletedAt: Date | null;
  readonly createdAt: Date;
}
