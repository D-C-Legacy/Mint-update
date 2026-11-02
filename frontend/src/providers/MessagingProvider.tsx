import React, { createContext, useCallback, useEffect, useState } from "react";
import { listMyConversations } from "../api/messaging";
import { useAuth } from "../hooks/useAuth";
import { useRealtime } from "../hooks/useRealtime";

// Mirrors NotificationsProvider exactly: owns only the unread-conversation count for the tab-bar
// badge, loaded after sign-in and bumped live on a `message.created` push. The conversation list
// itself is fetched by the Inbox screen directly, same "provider owns the count, screen owns the
// list" split NotificationsProvider already established.
type MessagingValue = {
  unreadCount: number;
  refresh: () => void;
};
export const MessagingContext = createContext<MessagingValue | null>(null);

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const userId = auth.state === "authenticated" ? (auth.user?.id ?? null) : null;
  const realtime = useRealtime();
  const [unreadCount, setUnreadCount] = useState(0);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    let cursor: string | undefined;
    let count = 0;
    do {
      const page = await listMyConversations(cursor);
      count += page.items.filter((c) => c.unread).length;
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return count;
  }, []);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    let alive = true;
    load()
      .then((count) => {
        if (alive) setUnreadCount(count);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [userId, tick, load]);

  useEffect(() => {
    if (!userId) return;
    return realtime.on("message.created", () => setUnreadCount((n) => n + 1));
  }, [userId, realtime]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  return <MessagingContext.Provider value={{ unreadCount, refresh }}>{children}</MessagingContext.Provider>;
}
