import React from "react";
import { View, Switch } from "react-native";
import { AppText, Button, Screen, s } from "../../components";
import { useApp } from "../../hooks";
import { usePreferences } from "../../hooks/usePreferences";
import { colors, spacing } from "../../theme";

// The app's own Notifications preferences (mobile). The web build has its own 2-column layout
// (`NotificationSettingsScreen.web.tsx`); this file is the single source of truth for the mobile
// layout, reused by the web narrow-width path.
export function NotificationSettingsScreen() {
  const app = useApp(),
    preferences = usePreferences();
  const labels = {
    live: "Sellers going live",
    bids: "Bid and auction updates",
    orders: "Order updates",
    messages: "Messages",
  } as const;
  return (
    <Screen title="Notifications" onBack={app.back}>
      <AppText muted>Choose what you want to hear about.</AppText>
      {preferences.loadFailed ? (
        <>
          <AppText muted>Couldn't load your preferences.</AppText>
          <Button secondary label="Try again" onPress={preferences.reload} />
        </>
      ) : null}
      {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => (
        <View key={key} style={[s.row, { paddingVertical: spacing.xl }]}>
          <AppText bold>{labels[key]}</AppText>
          <Switch
            accessibilityLabel={labels[key]}
            value={preferences.notifications[key]}
            disabled={!preferences.ready}
            trackColor={{ false: colors.line, true: colors.brand }}
            onValueChange={async (value) => {
              const saved = await preferences.updateNotifications({ [key]: value });
              if (!saved) app.toast("Couldn't save that change. Try again.");
            }}
          />
        </View>
      ))}
    </Screen>
  );
}
