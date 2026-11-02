import React from "react";
import { View } from "react-native";
import { AppText } from "../ui";
import { InitialsAvatar } from "./InitialsAvatar";
import { spacing } from "../../theme";
import type { LiveChatMessage } from "../../hooks/useLiveChat";

const shadow = {
  textShadowColor: "rgba(0,0,0,0.6)",
  textShadowRadius: 4,
  textShadowOffset: { width: 0, height: 1 },
};

// A live chat preview (the last few messages) overlaid on the video. Real messages now — fed by
// `useLiveChat` (room.state's recentMessages + the live chat.message WS events), not the old
// hardcoded `data/chat.ts` seed. Each has an initials placeholder (no avatar field exists anywhere
// in the schema), the display name in a thin white weight, and the comment underneath in bold white.
export function LiveChatOverlay({ comments }: { comments: LiveChatMessage[] }) {
  return (
    <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
      {comments.slice(-4).map((comment) => (
        <View key={comment.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
          <InitialsAvatar name={comment.displayName} size={28} />
          <View style={{ flexShrink: 1, gap: 0 }}>
            <AppText
              size={13}
              style={{
                color: "#FFFFFF",
                fontFamily: "Inter_700Bold",
                textShadowColor: "rgba(0,0,0,0.85)",
                textShadowRadius: 8,
                textShadowOffset: { width: 0, height: 0 },
              }}
            >
              {comment.displayName}
            </AppText>
            <AppText size={14} style={[{ color: "#FFFFFF", fontFamily: "Inter_300Light" }, shadow]}>
              {comment.body}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}
