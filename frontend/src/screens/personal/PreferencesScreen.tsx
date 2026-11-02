import React from 'react';
import { View, Switch } from 'react-native';
import { AppText, Button, Screen, s } from '../../components';
import { useApp } from '../../hooks';
import { usePreferences } from '../../hooks/usePreferences';
import { colors, spacing } from '../../theme';

export function PreferencesScreen() {
  const app = useApp();
  const prefs = usePreferences();

  const notifLabels = {
    live: 'Sellers going live',
    bids: 'Bid and auction updates',
    orders: 'Order updates',
    messages: 'Messages',
  } as const;

  const privacyLabels = {
    publicProfile: 'Public profile',
    showActivity: 'Show bidding activity',
    onlineStatus: 'Show online status',
  } as const;

  return (
    <Screen title="Preferences" onBack={app.back}>
      <AppText muted>Choose what you want to hear about.</AppText>
      {prefs.loadFailed ? (
        <>
          <AppText muted>Couldn't load your preferences.</AppText>
          <Button secondary label="Try again" onPress={prefs.reload} />
        </>
      ) : null}
      {(Object.keys(notifLabels) as (keyof typeof notifLabels)[]).map((key) => (
        <View key={key} style={[s.row, { paddingVertical: spacing.xl }]}>
          <AppText bold>{notifLabels[key]}</AppText>
          <Switch
            accessibilityLabel={notifLabels[key]}
            value={prefs.notifications[key]}
            disabled={!prefs.ready}
            trackColor={{ false: colors.line, true: colors.brand }}
            onValueChange={async (value) => {
              const saved = await prefs.updateNotifications({ [key]: value });
              if (!saved) app.toast("Couldn't save that change. Try again.");
            }}
          />
        </View>
      ))}

      <AppText muted style={{ marginTop: spacing.md }}>Your space, your choices.</AppText>
      {(Object.keys(privacyLabels) as (keyof typeof privacyLabels)[]).map((key) => (
        <View key={key} style={[s.row, { paddingVertical: spacing.xl }]}>
          <AppText bold>{privacyLabels[key]}</AppText>
          <Switch
            accessibilityLabel={privacyLabels[key]}
            value={prefs.privacy[key]}
            disabled={!prefs.ready}
            trackColor={{ false: colors.line, true: colors.brand }}
            onValueChange={async (value) => {
              const saved = await prefs.updatePrivacy({ [key]: value });
              if (!saved) app.toast("Couldn't save that change. Try again.");
            }}
          />
        </View>
      ))}
    </Screen>
  );
}
