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

// Desktop-only sibling of `StreamCard` (mobile stays untouched) — same real session data, a
// wider grid (4-up instead of 3-up) with room for a slightly bigger title/viewer-count treatment
// since desktop viewing distance and card size are both larger.
export function StreamCardDesktop({ session, onPress }: { session: StreamSession; onPress: () => void }) {
  return (
    <Pressable
      style={{ width: "23%", marginBottom: tokens.spacing.lg }}
      onPress={onPress}
      accessibilityLabel={`Watch ${session.title}`}
    >
      <View
        style={{
          width: "100%",
          aspectRatio: 0.72,
          borderRadius: tokens.radii.card,
          overflow: "hidden",
          backgroundColor: c.ink,
        }}
      >
        {session.thumbnailUrl ? (
          <Photo uri={session.thumbnailUrl} style={{ width: "100%", height: "100%" }} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Feather name="video" size={36} color="rgba(255,255,255,0.45)" />
          </View>
        )}
        <View style={{ position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.live }} />
          <AppText white bold size={11} style={textShadow}>
            LIVE
          </AppText>
        </View>
        <View style={{ position: "absolute", left: 10, right: 10, bottom: 10 }}>
          <AppText white bold size={13} numberOfLines={1} style={textShadow}>
            {session.title}
          </AppText>
          <AppText white size={11} numberOfLines={1} style={[textShadow, { marginTop: 2 }]}>
            {session.viewerCount} watching
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}
