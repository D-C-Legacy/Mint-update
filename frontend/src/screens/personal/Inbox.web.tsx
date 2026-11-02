import * as tokens from "../../theme";
import { ROUTES } from "../../constants/routes";
import React from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { AppText, EmptyState, Section } from "../../components";
import { useApp } from "../../context";
import { useInboxData } from "../../hooks/useInboxData";
import { ConversationRow, NotificationRow } from "./InboxRows";
import { Inbox as InboxMobile } from "./InboxMobile";

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile Inbox the app uses
// (`InboxMobile`) — web on a phone-width browser must look like the app. At/above it, the Inbox
// tab becomes two side-by-side columns instead of a chip switcher: Messages left, Activity right
// (founder feedback 16 Oct 2026: split every remaining page the same way as the Seller studio).
// The dedicated Activity screen (`activityOnly`) keeps the mobile layout at every width — it is a
// single list, so on desktop it renders inside the shell's narrow reading column like the other
// single-list screens, rather than getting a forced split. `showBack` forwards to the mobile
// layout (dropped when rendered as a tab).
const DESKTOP_BREAKPOINT = 768;

export function Inbox({
  activityOnly = false,
  showBack = true,
}: {
  activityOnly?: boolean;
  showBack?: boolean;
}) {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT)
    return <InboxMobile activityOnly={activityOnly} showBack={activityOnly ? false : showBack} />;
  return <DesktopInbox activityOnly={activityOnly} />;
}

function DesktopInbox({ activityOnly = false }: { activityOnly?: boolean }) {
  const app = useApp();
  const {
    items,
    conversations,
    notifStatus,
    convoStatus,
    notifError,
    convoError,
    openNotification,
  } = useInboxData();

  return (
    <ScrollView contentContainerStyle={{ padding: tokens.spacing.xl, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
      <AppText size={32} bold style={{ marginBottom: tokens.spacing.lg, alignSelf: 'flex-start' }}>
        {activityOnly ? 'Notifications' : 'Inbox'}
      </AppText>
      <View style={{ width: '100%', maxWidth: 560, gap: tokens.spacing.md }}>
        {!activityOnly && (
          <>
            <Section title="Messages" />
            {convoStatus === "loading" ? (
              <AppText muted>Loading…</AppText>
            ) : convoStatus === "error" ? (
              <EmptyState title="Couldn't load messages" detail={convoError} />
            ) : conversations.length === 0 ? (
              <AppText muted>No messages yet.</AppText>
            ) : (
              conversations.map((convo) => (
                <ConversationRow
                  key={convo.id}
                  convo={convo}
                  onPress={() => app.navigate(ROUTES.CONVERSATION, convo.sellerId)}
                />
              ))
            )}
          </>
        )}
        {!activityOnly && <Section title="Activity" />}
        {notifStatus === "loading" ? (
          <AppText muted>Loading…</AppText>
        ) : notifStatus === "error" ? (
          <EmptyState title="Couldn't load activity" detail={notifError} />
        ) : items.length === 0 ? (
          <AppText muted>No activity yet.</AppText>
        ) : (
          items.map((item) => (
            <NotificationRow key={item.id} item={item} onPress={() => openNotification(item)} />
          ))
        )}
      </View>
    </ScrollView>
  );
}
