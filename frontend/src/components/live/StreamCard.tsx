import * as tokens from "../../theme";
import React from "react";
import { View, Pressable } from "react-native";
import { colors as c } from "../../theme";
import type { StreamSession } from "../../api/streams";
import { AppText, Photo } from "../ui";
import { Feather } from "@expo/vector-icons";

const textShadow = {
  textShadowColor: "rgba(0,0,0,0.6)",
  textShadowRadius: 4,
  textShadowOffset: { width: 0, height: 1 },
};

// A real live session's card: its thumbnail (when the seller has one — the field is nullable, a
// plain icon placeholder shows instead of a fabricated stock photo when it's missing), title and
// live viewer count overlaid on the image itself, portrait, three-per-row.
export function StreamCard({ session, onPress }: { session: StreamSession; onPress: () => void }) {
  return (
    <Pressable
      style={{ width: "31%", marginBottom: tokens.spacing.md }}
      onPress={onPress}
      accessibilityLabel={`Watch ${session.title}`}
    >
      <View
        style={{
          width: "100%",
          aspectRatio: 0.72,
          borderRadius: tokens.radii.md,
          overflow: "hidden",
          backgroundColor: c.ink,
        }}
      >
        {session.thumbnailUrl ? (
          <Photo uri={session.thumbnailUrl} style={{ width: "100%", height: "100%" }} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Feather name="video" size={28} color="rgba(255,255,255,0.45)" />
          </View>
        )}
        <View style={{ position: "absolute", top: 7, left: 7, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: c.live }} />
          <AppText white bold size={9} style={textShadow}>
            LIVE
          </AppText>
        </View>
        <View style={{ position: "absolute", left: 7, right: 7, bottom: 7 }}>
          <AppText white bold size={10} numberOfLines={1} style={textShadow}>
            {session.title}
          </AppText>
          <AppText white size={8} numberOfLines={1} style={[textShadow, { marginTop: 1 }]}>
            {session.viewerCount} watching
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}
