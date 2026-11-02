import * as tokens from "../../theme";
import React from "react";
import { View, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppText } from "../ui";

const shadow = {
  textShadowColor: "rgba(0,0,0,0.6)",
  textShadowRadius: 4,
  textShadowOffset: { width: 0, height: 1 },
};

// One action in the right-hand column: icon with its label underneath, no background. `width`
// (not `minWidth`) is fixed so every button is the same box regardless of label length — icon and
// label both center inside it, and their boxes line up flush at the same right edge (founder
// feedback, 27 Oct 2026: icons weren't centered over their own labels).
function RailAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: "center", gap: 3, opacity: pressed ? 0.7 : 1, width: 52 })}
    >
      <Feather name={icon} size={26} color={tokens.colors.canvas} style={shadow} />
      <AppText white size={12} bold style={shadow}>
        {label}
      </AppText>
    </Pressable>
  );
}

// Right-hand action column: share, wallet, shop. "More" was a debug menu for the old mock auction
// states and had no real action to take its place, so it was dropped rather than kept as a dead
// button.
export function LiveActionRail({
  onShare,
  onShop,
  onWallet,
}: {
  onShare: () => void;
  onShop: () => void;
  onWallet: () => void;
}) {
  return (
    <View style={{ alignItems: "center", gap: 22, paddingBottom: 6 }}>
      <RailAction icon="share-2" label="Share" onPress={onShare} />
      <RailAction icon="credit-card" label="Wallet" onPress={onWallet} />
      <RailAction icon="shopping-bag" label="Shop" onPress={onShop} />
    </View>
  );
}
