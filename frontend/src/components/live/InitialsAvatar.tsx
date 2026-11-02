import React from "react";
import { View } from "react-native";
import { AppText } from "../ui";
import { colors as c } from "../../theme";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]![0] ?? "" : "";
  return (first + last).toUpperCase();
}

// No avatar/profile-picture field exists anywhere in the schema (confirmed against the Prisma
// models, not assumed) — this is what the bid-feedback win moment renders instead, never a
// fabricated stock photo standing in for a real person.
export function InitialsAvatar({ name, size = 56 }: { name: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.brand,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText white bold size={size * 0.38}>
        {initialsFor(name)}
      </AppText>
    </View>
  );
}
