import { api } from './index';
import type { Page } from './catalog';

// GET /v1/me/notifications, POST /v1/me/notifications/:id/read. Not in 05-API-SPEC.md: added on
// the user's instruction so the inbox can show real notification history and an unread badge.
export type NotificationItem = {
  id: string;
  templateKey: string;
  content: { title?: string; body?: string; subject?: string; ref?: { type: string; id: string } };
  readAt: string | null;
  createdAt: string;
};

export function listNotifications(
  cursor?: string,
): Promise<Page<NotificationItem> & { unreadCount: number }> {
  return api.request<Page<NotificationItem> & { unreadCount: number }>('/me/notifications', {
    query: { limit: 20, cursor },
  });
}

export function markNotificationRead(id: string): Promise<NotificationItem> {
  return api.request<NotificationItem>(`/me/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST',
  });
}

// POST /v1/me/notifications/read-all — marks every unread EMAIL delivery read for the user, not
// just the loaded page. Not in 05-API-SPEC.md (Phase 4, user-directed).
export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return api.request<{ updated: number }>('/me/notifications/read-all', { method: 'POST' });
}

// DELETE /v1/me/notifications/:id — soft delete; the notification disappears from the user's list
// permanently (the server keeps the send record behind a deletedAt filter). Not in 05-API-SPEC.md
// (Phase 4, user-directed).
export function deleteNotification(id: string): Promise<{ id: string; deleted: boolean }> {
  return api.request<{ id: string; deleted: boolean }>(
    `/me/notifications/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  );
}

// Rendered by the backend's email template per templateKey (notifications.service.ts) — title/body
// for push templates, subject/body for email ones. Both are always present on the ones this inbox
// lists (it only ever lists the EMAIL delivery, see NotificationRepositoryPort.listForUser).
export function notificationText(item: NotificationItem): { title: string; body: string } {
  return {
    title: item.content.subject ?? item.content.title ?? 'Notification',
    body: item.content.body ?? '',
  };
}
