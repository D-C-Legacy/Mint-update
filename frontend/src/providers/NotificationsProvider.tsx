import React, { createContext, useCallback, useEffect, useState } from "react";
import {
  deleteNotification as deleteNotificationApi,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../api/notifications";
import { useAuth } from "../hooks/useAuth";
import { useRealtime } from "../hooks/useRealtime";

// Tracks the inbox's unread count for the tab bar badge (MainTabNavigator) and keeps it live:
// loaded after sign-in, bumped the moment a `notification.created` WS push arrives, and dropped
// when the inbox screen marks something read. The notification list itself is fetched by the
// Inbox screen directly (same pattern MyOrders uses for orders) — this provider only owns the count.
type NotificationsValue = {
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** `wasUnread` lets the (single, precise) unread decrement happen only for a deleted row that
   *  actually still counted — the caller already has the row in hand. */
  deleteNotification: (id: string, wasUnread: boolean) => Promise<void>;
  refresh: () => void;
};
export const NotificationsContext = createContext<NotificationsValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const userId = auth.state === "authenticated" ? (auth.user?.id ?? null) : null;
  const realtime = useRealtime();
  const [unreadCount, setUnreadCount] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    let alive = true;
    listNotifications()
      .then((page) => {
        if (alive) setUnreadCount(page.unreadCount);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [userId, tick]);

  useEffect(() => {
    if (!userId) return;
    return realtime.on("notification.created", () => setUnreadCount((n) => n + 1));
  }, [userId, realtime]);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setUnreadCount((n) => Math.max(0, n - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setUnreadCount(0);
  }, []);

  const deleteNotification = useCallback(
    async (id: string, wasUnread: boolean) => {
      await deleteNotificationApi(id);
      if (wasUnread) setUnreadCount((n) => Math.max(0, n - 1));
    },
    [],
  );

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  return (
    <NotificationsContext.Provider value={{ unreadCount, markRead, markAllRead, deleteNotification, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}
