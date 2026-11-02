import React from "react";
import { View } from "react-native";
import { AppText } from "../ui";
import { InitialsAvatar } from "./InitialsAvatar";
import { colors as c, spacing, formatUSD } from "../../theme";
import type { WinMoment as WinMomentData } from "../../hooks/useLiveReel";

const shadow = {
  textShadowColor: "rgba(0,0,0,0.6)",
  textShadowRadius: 4,
  textShadowOffset: { width: 0, height: 1 },
};

// The founder was specific: no banner, no whatnot-style flashy animation. Everything here is plain
// white text (with the same shadow treatment the rest of the live overlay already uses) directly
// on the video — never a colored box or a confetti burst.

// A single current-leader line, not a scrolling feed of every bid.
export function LeaderLine({ leaderName, leading }: { leaderName: string | null; leading: boolean }) {
  if (!leaderName) return null;
  return (
    <AppText bold size={13} white style={shadow}>
      {leading ? "You're leading" : `${leaderName} is leading`}
    </AppText>
  );
}

// Outbid / "now featuring" notices: one quiet line, auto-clearing on its own — not a persistent
// banner.
export function QuietNotice({ text }: { text: string }) {
  return (
    <AppText bold size={13} white style={[shadow, { color: c.urgent }]}>
      {text}
    </AppText>
  );
}

// The win/purchase moment. An auction win is the centered, personal moment the founder described:
// an initials placeholder (no avatar field exists anywhere in the schema) and a name, nothing
// else. A buy-now purchase is deliberately kept visually separate — a smaller, lower-anchored row,
// never the same full moment as winning an auction.
export function WinMoment({ data }: { data: WinMomentData }) {
  const amount = formatUSD(data.finalAmount / 100);
  // An accepted offer resolves the sale exactly like a buy-now purchase (a real order gets
  // created the same way) — it gets the same small purchase row, never the big auction-win moment.
  if (data.mode === "BUY_NOW" || data.mode === "OFFER") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <InitialsAvatar name={data.winnerName} size={32} />
        <AppText size={14} white style={shadow}>
          <AppText bold white style={shadow}>
            {data.winnerName}
          </AppText>{" "}
          just bought this · {amount}
        </AppText>
      </View>
    );
  }
  return (
    <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg }}>
      <InitialsAvatar name={data.winnerName} size={64} />
      <AppText bold size={20} white style={shadow}>
        {data.winnerName} won it!
      </AppText>
      <AppText size={15} white style={shadow}>
        {amount}
      </AppText>
    </View>
  );
}
