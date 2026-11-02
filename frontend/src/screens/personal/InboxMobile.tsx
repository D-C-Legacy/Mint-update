import { ROUTES } from '../../constants/routes';
import React from 'react';
import { Pressable } from 'react-native';
import { AppText, EmptyState, Screen, Section } from '../../components';
import { colors as c } from '../../theme';
import { useApp } from '../../context';
import { useInboxData } from '../../hooks/useInboxData';
import { ConversationRow, NotificationRow } from './InboxRows';

// The app's own Inbox. One screen, Messages then Activity stacked — exactly the same two sections
// `Inbox.web.tsx`'s desktop layout shows side by side, just reflowed to one column instead of two
// for a narrow screen. No toggle, no separate "Activity" destination to switch to from here (two
// earlier attempts both still read as "tabs within tabs" to the founder — a chip switcher, then a
// bell leading to a separate screen; what was actually asked for, 28 Oct 2026, was this: everything
// on one screen, matching web). This file is the single source of truth for the narrower layout,
// reused by the web narrow-width path.
//
// `activityOnly` is still its own dedicated screen, just no longer reached from the Inbox tab —
// web's own notifications bell dropdown ("View all") pushes `ROUTES.ACTIVITY` directly from
// anywhere in the app. `showBack` keeps the back button only for that pushed case.
export function Inbox({
  activityOnly = false,
  showBack = true,
}: {
  activityOnly?: boolean;
  showBack?: boolean;
}) {
  const app = useApp();
  const {
    items,
    conversations,
    notifStatus,
    convoStatus,
    notifError,
    convoError,
    openNotification,
    markAllRead,
    deleteNotification,
  } = useInboxData();
  const unreadActivity = items.some((n) => n.readAt === null);

  return (
    <Screen
      title={activityOnly ? 'Notifications' : ROUTES.INBOX}
      onBack={activityOnly && showBack ? app.back : undefined}
      right={
        unreadActivity ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mark all read"
            onPress={() => markAllRead()}
          >
            <AppText size={13} style={{ color: c.brand }}>
              Mark all read
            </AppText>
          </Pressable>
        ) : undefined
      }
    >
      {!activityOnly && (
        <>
          <Section title="Messages" />
          {convoStatus === 'loading' ? (
            <AppText muted>Loading…</AppText>
          ) : convoStatus === 'error' ? (
            <EmptyState title="Couldn't load messages" detail={convoError} />
          ) : conversations.length === 0 ? (
            <EmptyState title="No messages yet" detail="Questions to sellers show up here." />
          ) : (
            conversations.map((convo) => (
              <ConversationRow
                key={convo.id}
                convo={convo}
                onPress={() => app.navigate(ROUTES.CONVERSATION, convo.sellerId)}
              />
            ))
          )}
          <Section title="Activity" />
        </>
      )}
      {notifStatus === 'loading' ? (
        <AppText muted>Loading…</AppText>
      ) : notifStatus === 'error' ? (
        <EmptyState title="Couldn't load activity" detail={notifError} />
      ) : items.length === 0 ? (
        <EmptyState title="No activity yet" detail="Order and account updates show up here." />
      ) : (
        items.map((item) => (
          <NotificationRow
            key={item.id}
            item={item}
            onPress={() => openNotification(item)}
            onDelete={() => deleteNotification(item)}
          />
        ))
      )}
    </Screen>
  );
}
