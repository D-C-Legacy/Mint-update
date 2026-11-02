import * as tokens from "../../theme";
import { ROUTES } from "../../constants/routes";
import React from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { AppText, Avatar, Badge, EmptyState, Photo, Section } from "../../components";
import { useAsync } from "../../api/use-async";
import { useApp } from "../../context";
import { stockImageFor } from "../../utils/stock-image";
import { CONDITION_LABELS } from "../../api/catalog";
import { ProductGrid } from "./shared";
import { SaleActions } from "./SaleActions";
import { ProductDetailMobile, loadDetail, type DetailData } from "./ProductDetailMobile";

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile product page the app uses
// (`ProductDetailMobile`) — web on a phone-width browser must look like the app. At/above it,
// this renders a standard e-commerce two-column layout: a large image left, title/price/buy and
// seller info right, instead of the mobile single-column stack. Same `loadDetail` loader and the
// same `SaleActions` bid/buy logic either way — only the layout forks.
const DESKTOP_BREAKPOINT = 768;

export function ProductDetail({ id }: { id?: string }) {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT) return <ProductDetailMobile id={id} />;
  return <DesktopProductDetail id={id} />;
}

function DesktopProductDetail({ id }: { id?: string }) {
  const productId = id ?? "";
  const detail = useAsync(() => loadDetail(productId), [productId]);

  return (
    <ScrollView contentContainerStyle={{ padding: tokens.spacing.xl }} showsVerticalScrollIndicator={false}>
      {detail.state.status === "loading" ? (
        <AppText muted>Loading…</AppText>
      ) : detail.state.status === "error" ? (
        <EmptyState title="Couldn't open this find" detail={detail.state.message} />
      ) : (
        <DesktopBody data={detail.state.data} />
      )}
    </ScrollView>
  );
}

function DesktopBody({ data }: { data: DetailData }) {
  const app = useApp();
  const { product, sale, channel, more } = data;
  const badge = !sale
    ? "NOT FOR SALE"
    : sale.mode === "AUCTION"
      ? "AUCTION"
      : sale.mode === "BUY_NOW"
        ? "BUY NOW"
        : "OFFERS";

  return (
    <View style={{ gap: tokens.spacing.section }}>
      <View style={{ flexDirection: "row", gap: tokens.spacing.xxl }}>
        <Photo
          uri={product.images[0]?.url ?? stockImageFor(product.id)}
          style={{ flex: 1, aspectRatio: 1, borderRadius: tokens.radii.cardLarge }}
        />
        <View style={{ width: 400, gap: tokens.spacing.md }}>
          <Badge label={badge} color={sale ? undefined : tokens.colors.textSecondary} />
          <AppText size={28} bold>
            {product.title}
          </AppText>
          <AppText muted>
            {CONDITION_LABELS[product.condition]} · {product.available} available
            {product.weightGrams ? ` · ${product.weightGrams} g` : ""}
          </AppText>
          {sale ? (
            <SaleActions key={sale.id} sale={sale} />
          ) : (
            <AppText muted>Not listed for sale right now.</AppText>
          )}
          {channel ? (
            <Pressable
              onPress={() => app.navigate(ROUTES.SELLER, channel.slug)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 10,
                paddingVertical: tokens.spacing.md,
                borderTopWidth: 1,
                borderTopColor: tokens.colors.line,
                marginTop: tokens.spacing.sm,
              }}
            >
              <Avatar uri={channel.bannerUrl ?? stockImageFor(channel.id)} />
              <View>
                <AppText bold>{channel.name}</AppText>
                <AppText muted size={12}>
                  {channel.followerCount} followers
                </AppText>
              </View>
            </Pressable>
          ) : null}
          {product.description ? (
            <View style={{ gap: 4 }}>
              <AppText bold>Description</AppText>
              <AppText muted>{product.description}</AppText>
            </View>
          ) : null}
        </View>
      </View>
      {more.length > 0 ? (
        <View>
          <Section title="More from this seller" />
          <ProductGrid items={more} />
        </View>
      ) : null}
    </View>
  );
}
