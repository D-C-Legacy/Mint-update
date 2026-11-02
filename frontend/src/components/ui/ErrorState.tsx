import React from "react";
import { View } from "react-native";
import { AppText, Button, Icon } from "./index";
import { colors, spacing } from "../../theme";
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        alignItems: "center",
        gap: spacing.lg,
        paddingVertical: spacing.section,
      }}
    >
      <Icon name="alert-circle-outline" color={colors.live} size={40} />
      <AppText bold size={22}>
        {title}
      </AppText>
      <AppText muted style={{ textAlign: "center" }}>
        {message}
      </AppText>
      <Button label="Try again" onPress={onRetry} />
    </View>
  );
}
