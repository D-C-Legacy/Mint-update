import * as tokens from "../../theme";
import { ROUTES } from "../../constants/routes";
import React from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { AppText, Avatar, Button, EmptyState, Screen } from "../../components";
import { colors as c } from "../../theme";
import { useApp } from "../../context";
import { stockImageFor } from "../../utils/stock-image";
import { useSellerProfile } from "../../hooks/useSellerProfile";
import { SellerContent } from "./SellerContent";
import { SellerProfile as SellerProfileMobile } from "./SellerProfileMobile";

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile seller page the app uses
// (`SellerProfileMobile`). At/above it, the page splits: a sticky channel card (avatar, name, bio,
// followers, Follow/Message) on the left, the tabbed Shop/Reviews/About content on the right.
const DESKTOP_BREAKPOINT = 768;

export function SellerProfile({ slug }: { slug: string }) {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT) return <SellerProfileMobile slug={slug} />;
  return <DesktopSellerProfile slug={slug} />;
}

function DesktopSellerProfile({ slug }: { slug: string }) {
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
    <View style={{ flex: 1, flexDirection: "row" }}>
      <ScrollView
        style={{ width: 320, borderRightWidth: 1, borderColor: c.line }}
        contentContainerStyle={{ padding: tokens.spacing.xl, gap: tokens.spacing.md }}
      >
        <Avatar uri={channel.bannerUrl ?? stockImageFor(channel.id)} size={88} />
        <AppText size={24} bold>
          {channel.name}
        </AppText>
        {channel.bio ? <AppText muted>{channel.bio}</AppText> : null}
        <AppText size={13} bold>
          {channel.followerCount} followers
          {ratingSummary.reviewCount > 0
            ? ` · ★ ${ratingSummary.averageRating.toFixed(1)} (${ratingSummary.reviewCount})`
            : ""}
        </AppText>
        <Button
          label={following === null ? "…" : following ? "Unfollow" : "Follow"}
          loading={busy}
          disabled={following === null}
          variant={following ? "secondary" : "primary"}
          onPress={toggleFollow}
        />
        <Button
          secondary
          label="Message"
          onPress={() => app.navigate(ROUTES.CONVERSATION, channel.sellerId)}
        />
      </ScrollView>

      <View style={{ flex: 1 }}>
        <Screen title={channel.name} onBack={app.back}>
          <SellerContent tab={tab} onTab={setTab} cards={cards} reviews={reviews} channel={channel} />
        </Screen>
      </View>
    </View>
  );
}
