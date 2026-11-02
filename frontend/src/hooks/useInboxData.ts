import { useEffect, useState } from 'react';
import { ROUTES } from '../constants/routes';
import { useApp } from '../context';
import { useNotifications } from './useNotifications';
import { useMessaging } from './useMessaging';
import { listNotifications, type NotificationItem } from '../api/notifications';
import { listMyConversations, type ConversationView } from '../api/messaging';
import { describeApiError } from '../api/describe-error';

export type LoadStatus = 'loading' | 'ready' | 'error';

// Shared Inbox data + actions, used by both the mobile single-tab layout and the desktop two-column
// layout (Messages | Activity). Both lists load up front so the desktop can show them side by side;
// the mobile just renders whichever tab is active.
export function useInboxData() {
  const app = useApp();
  const notifications = useNotifications();
  const messaging = useMessaging();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [notifStatus, setNotifStatus] = useState<LoadStatus>('loading');
  const [convoStatus, setConvoStatus] = useState<LoadStatus>('loading');
  const [notifError, setNotifError] = useState('');
  const [convoError, setConvoError] = useState('');

  useEffect(() => {
    let alive = true;
    setNotifStatus('loading');
    listNotifications()
      .then((page) => {
        if (!alive) return;
        setItems(page.items);
        setNotifStatus('ready');
      })
      .catch((err) => {
        if (!alive) return;
        setNotifError(describeApiError(err));
        setNotifStatus('error');
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setConvoStatus('loading');
    listMyConversations()
      .then((page) => {
        if (!alive) return;
        setConversations(page.items);
        setConvoStatus('ready');
      })
      .catch((err) => {
        if (!alive) return;
        setConvoError(describeApiError(err));
        setConvoStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [messaging.unreadCount]);

  // Mark a notification read (optimistic) and route order/sale notifications to the orders list.
  async function openNotification(item: NotificationItem) {
    if (item.readAt === null) {
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      try {
        await notifications.markRead(item.id);
      } catch {
        // The row already shows read; a failed server call here is not worth rolling back over —
        // it's just read state, not data the user acted on.
      }
    }
    const key = item.templateKey;
    const ref = item.content.ref;
    if (ref) {
      const refType = ref.type;
      const refId = ref.id;
      if (refType === 'order' || refType === 'purchase') {
        app.navigate(ROUTES.ORDERS);
        // GAP: without order-specific route/params, deep-link stops at Orders list.
      } else if (refType === 'stream' || refType === 'stream') {
        app.navigate(ROUTES.DISCOVER);
      } else if (refType === 'message') {
        app.navigate(ROUTES.INBOX);
      } else {
        app.navigate(ROUTES.INBOX);
      }
    } else {
      // Fallback without structured ref
      if (key.startsWith('order.') || key === 'sale.resolved' || key.includes('purchase')) {
        app.navigate(ROUTES.ORDERS);
      } else if (key.includes('sale') || key.includes('auction') || key.includes('bid')) {
        app.navigate(ROUTES.DISCOVER);
      } else if (key.includes('message') || key.includes('chat')) {
        app.navigate(ROUTES.INBOX);
      } else {
        app.navigate(ROUTES.INBOX);
      }
    }
  }

  // Mark every notification read (optimistic) via POST /me/notifications/read-all — the whole
  // mailbox for this user, not just the loaded page. Same no-rollback tolerance as
  // openNotification: it is read state, not data the user acted on. A failure still gets a toast
  // (the badge keeps the server's true count since the provider call just threw).
  async function markAllRead() {
    if (items.some((n) => n.readAt === null)) {
      setItems((prev) =>
        prev.map((n) => (n.readAt === null ? { ...n, readAt: new Date().toISOString() } : n)),
      );
    }
    try {
      await notifications.markAllRead();
    } catch (err) {
      app.toast(describeApiError(err));
    }
  }

  // Delete a notification (optimistic — removed from the list right away). Unlike read state,
  // deletion is destructive, so a failed server call rolls the row back and toasts instead of
  // leaving the UI disagreeing with the server.
  async function deleteNotification(item: NotificationItem) {
    const previous = items;
    setItems((prev) => prev.filter((n) => n.id !== item.id));
    try {
      await notifications.deleteNotification(item.id, item.readAt === null);
    } catch (err) {
      setItems(previous);
      app.toast(describeApiError(err));
    }
  }

  return {
    items,
    conversations,
    notifStatus,
    convoStatus,
    notifError,
    convoError,
    openNotification,
    markAllRead,
    deleteNotification,
  };
}
