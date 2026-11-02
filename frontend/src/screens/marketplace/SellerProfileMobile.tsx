import * as tokens from "../../theme";
import { ROUTES } from "../../constants/routes";
import React from "react";
import { View } from "react-native";
import { AppText, Avatar, Button, EmptyState, Screen, s } from "../../components";
import { useApp } from "../../context";
import { stockImageFor } from "../../utils/stock-image";
import { useSellerProfile } from "../../hooks/useSellerProfile";
import { SellerContent } from "./SellerContent";

// The app's own seller page (mobile). The web build has its own 2-column layout
// (`SellerProfile.web.tsx`); this file is the single source of truth for the mobile layout, reused by
// the web narrow-width path.
export function SellerProfile({ slug }: { slug: string }) {
  const app = useApp();
  const { detail, tab, setTab, following, toggleFollow, busy } = useSellerProfile(slug);

  if (detail.state.status === "loading") {
    return (
      <Screen title="Seller" onBack={app.back}>
        <AppText muted>Loading…</AppText>
      </Screen>
    );
  }
  if (detail.state.status === "error") {
    return (
      <Screen title="Seller" onBack={app.back}>
        <EmptyState title="Couldn't open this seller" detail={detail.state.message} />
      </Screen>
    );
  }

  const { channel, cards, reviews, ratingSummary } = detail.state.data;

  return (
    <Screen title={channel.name} onBack={app.back}>
      <View style={{ alignItems: "center", gap: 10 }}>
        <Avatar uri={channel.bannerUrl ?? stockImageFor(channel.id)} size={88} />
        <AppText size={28} bold>
          {channel.name}
        </AppText>
        {channel.bio ? <AppText style={{ textAlign: "center" }}>{channel.bio}</AppText> : null}
        <AppText size={13} bold>
          {channel.followerCount} followers
          {ratingSummary.reviewCount > 0
            ? ` · ★ ${ratingSummary.averageRating.toFixed(1)} (${ratingSummary.reviewCount})`
            : ""}
        </AppText>
      </View>
      <View style={[s.row, { gap: tokens.spacing.md, marginVertical: tokens.spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Button
            label={following === null ? "…" : following ? "Unfollow" : "Follow"}
            loading={busy}
            disabled={following === null}
            variant={following ? "secondary" : "primary"}
            onPress={toggleFollow}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            secondary
            label="Message"
            onPress={() => app.navigate(ROUTES.CONVERSATION, channel.sellerId)}
          />
        </View>
      </View>
      <SellerContent tab={tab} onTab={setTab} cards={cards} reviews={reviews} channel={channel} />
    </Screen>
  );
}
