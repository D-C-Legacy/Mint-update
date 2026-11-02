import React from "react";
import { View, Switch } from "react-native";
import { AppText, Button, Screen, s } from "../../components";
import { useApp } from "../../hooks";
import { usePreferences } from "../../hooks/usePreferences";
import { colors, spacing } from "../../theme";
export function PrivacyScreen({ inline = false }: { inline?: boolean }) {
  const app = useApp(),
    prefs = usePreferences();
  const labels = {
    publicProfile: "Public profile",
    showActivity: "Show bidding activity",
    onlineStatus: "Show online status",
  } as const;
  return (
    <Screen title="Privacy" onBack={inline ? undefined : app.back}>
      <AppText muted>Your space, your choices.</AppText>
      {prefs.loadFailed ? (
        <>
          <AppText muted>Couldn't load your preferences.</AppText>
          <Button secondary label="Try again" onPress={prefs.reload} />
        </>
      ) : null}
      {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => (
        <View key={key} style={[s.row, { paddingVertical: spacing.xl }]}>
          <AppText bold>{labels[key]}</AppText>
          <Switch
            accessibilityLabel={labels[key]}
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
