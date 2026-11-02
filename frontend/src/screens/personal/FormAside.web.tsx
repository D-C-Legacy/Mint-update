import * as tokens from "../../theme";
import React from "react";
import { View, useWindowDimensions } from "react-native";

const DESKTOP_BREAKPOINT = 768;

// Shared desktop layout for a settings form: the form on the left, a short contextual aside on the
// right. These are single forms with no natural second column, so the aside carries real help text
// rather than a forced split. Narrow width renders the form on its own (the mobile layout).
export function FormAside({ form, aside }: { form: React.ReactNode; aside: React.ReactNode }) {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT) return <>{form}</>;
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: tokens.spacing.xxl }}>
      <View style={{ flex: 1 }}>{form}</View>
      <View style={{ width: 320 }}>{aside}</View>
    </View>
  );
}
