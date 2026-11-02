import {
  NotificationChannel,
  NotificationDelivery,
  NotificationDeliveryStatus,
} from '../entities/notification-delivery.entity';

export const NOTIFICATION_REPOSITORY = Symbol('NotificationRepositoryPort');

export interface CreateDeliveryInput {
  readonly id: string;
  readonly userId: string;
  readonly channel: NotificationChannel;
  readonly templateKey: string;
  readonly recipient: string;
  readonly content: Record<string, unknown>;
}

export interface UpdateDeliveryOutcomeInput {
  readonly status: NotificationDeliveryStatus;
  readonly providerMessageId: string | null;
  readonly failureReason: string | null;
  readonly sentAt: Date | null;
}

export interface ListForUserFilter {
  readonly userId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface NotificationRepositoryPort {
  createDelivery(input: CreateDeliveryInput): Promise<NotificationDelivery>;
  updateDeliveryOutcome(
    id: string,
    input: UpdateDeliveryOutcomeInput,
  ): Promise<NotificationDelivery>;
  findDeliveryById(id: string): Promise<NotificationDelivery | null>;
  listDeliveriesForUser(userId: string, limit: number): Promise<NotificationDelivery[]>;
  /** The user's inbox, newest first. Filtered to `channel='EMAIL'` only: `notify()` fans one
   *  logical notification out to one EMAIL delivery plus one PUSH delivery per registered device,
   *  and EMAIL is the only channel guaranteed to be sent exactly once per user per event — listing
   *  every channel would show the same notification duplicated per device. Soft-deleted rows
   *  (user deletes) are excluded. Cursor is the last row's id, same idiom as orders'/addresses'
   *  list queries. */
  listForUser(filter: ListForUserFilter): Promise<NotificationDelivery[]>;
  /** Unread count for the badge — same EMAIL-only filter as `listForUser`, soft-deleted excluded. */
  countUnreadForUser(userId: string): Promise<number>;
  /** Sets `readAt` if not already set (idempotent); null means no EMAIL delivery with this id
   *  belongs to this user. */
  markRead(id: string, userId: string): Promise<NotificationDelivery | null>;
  /** Sets `readAt` (now) on every unread EMAIL delivery belonging to the user; returns how many
   *  rows were updated. Idempotent — already-read rows never match the filter. Not in the spec:
   *  the Activity screen's mark-all-read button (Phase 4, user-directed). */
  markAllRead(userId: string): Promise<number>;
  /** Soft-deletes the user's EMAIL delivery row (sets `deletedAt`, never a hard delete — the send
   *  record is the notification system's audit row). Returns the row once deleted, or null when no
   *  non-deleted EMAIL delivery with this id belongs to this user (a foreign id AND an
   *  already-deleted id both look identical: NOT_FOUND). Not in the spec: the Activity screen's
   *  per-row delete (Phase 4, user-directed soft-delete decision). */
  deleteNotification(id: string, userId: string): Promise<NotificationDelivery | null>;
}
