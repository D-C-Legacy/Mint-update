import React from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { APP_NAME } from "../../constants";
import { colors, spacing } from "../../theme";
import { AppText, Icon } from "../../components";
export function SplashScreen() {
  return (
    <View
      accessibilityLabel={`${APP_NAME} splash`}
      style={{
        flex: 1,
        backgroundColor: colors.ink,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.lg,
      }}
    >
      <StatusBar style="light" />
      <Icon name="radio-outline" color={colors.brand} size={64} />
      <AppText white bold size={48}>
        {APP_NAME}
      </AppText>
    </View>
  );
}
