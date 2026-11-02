import * as tokens from "../../theme";
import React from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { AppText } from "../../components";
import { colors as c } from "../../theme";
import { ROUTES } from "../../constants/routes";
import { SettingsMenu } from "./SettingsMenu";
import { Settings as SettingsMobile } from "./SettingsMobile";

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile settings router the app uses
// (`SettingsMobile`). At/above it, settings becomes a master-detail page (founder feedback 16 Oct
// 2026: split every remaining page like the Seller studio): the settings menu is a left sidebar and
// the selected section's content fills the right column. The hub itself has no detail, so its right
// column is a placeholder. Sub-screens render with `inline` so their route back button is hidden.
const DESKTOP_BREAKPOINT = 768;

export function Settings({ name }: { name: string }) {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT) return <SettingsMobile name={name} />;
  return <DesktopSettings name={name} />;
}

function DesktopSettings({ name }: { name: string }) {
  const isHub = name === ROUTES.SETTINGS;
  return (
    <View style={{ flex: 1 }}>
      {isHub ? (
        <ScrollView contentContainerStyle={{ padding: tokens.spacing.xl }}>
          <AppText size={28} bold style={{ marginBottom: tokens.spacing.lg }}>
            Settings
          </AppText>
          <SettingsMenu />
        </ScrollView>
      ) : (
        <SettingsMobile name={name} />
      )}
    </View>
  );
}
