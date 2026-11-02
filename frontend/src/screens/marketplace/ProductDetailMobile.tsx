import * as tokens from "../../theme";
import { ROUTES } from "../../constants/routes";
import React from "react";
import { Pressable, View } from "react-native";
import { AppText, Avatar, Badge, EmptyState, Photo, Screen, Section } from "../../components";
import {
  CONDITION_LABELS,
  getProduct,
  listOpenSales,
  listProducts,
  toCards,
  type CardProduct,
  type PublicProduct,
  type PublicSale,
} from "../../api/catalog";
import { listChannels, type ChannelSummary } from "../../api/channels";
import { useAsync } from "../../api/use-async";
import { useApp } from "../../context";
import { stockImageFor } from "../../utils/stock-image";
import { ProductGrid } from "./shared";
import { SaleActions } from "./SaleActions";

export type DetailData = {
  product: PublicProduct;
  sale: PublicSale | null;
  channel: ChannelSummary | null;
  more: CardProduct[];
};

// One product page: the product, its open sale, its seller's channel, and more from that seller.
// Each part comes from a public read; the sale panel reads the live sale itself. Shared with the
// desktop layout (`ProductDetail.web.tsx`), which calls this same loader — only the layout forks.
export async function loadDetail(productId: string): Promise<DetailData> {
  const product = await getProduct(productId);
  const [sales, channels, others] = await Promise.all([
    listOpenSales({ productId, limit: 1 }),
    listChannels({ sellerId: product.sellerId, limit: 1 }),
    listProducts({ sellerId: product.sellerId, limit: 12 }),
  ]);
  return {
    product,
    sale: sales.items[0] ?? null,
    channel: channels.items[0] ?? null,
    more: await toCards(others.items.filter((other) => other.id !== product.id)),
  };
}

// The app's own product page. Single source of truth for that layout: the native entry point
// (`ProductDetail.tsx`) re-exports it unchanged, and the web entry point (`ProductDetail.web.tsx`)
// renders it too at phone-width viewports, same pattern as the other screens in this arc. Only
// `ProductDetail.web.tsx` has a second, desktop-only two-column layout.
export function ProductDetailMobile({ id }: { id?: string }) {
  const app = useApp();
  const productId = id ?? "";
  const detail = useAsync(() => loadDetail(productId), [productId]);

  return (
    <Screen title="The find" onBack={app.back}>
      {detail.state.status === "loading" ? (
        <AppText muted>Loading…</AppText>
      ) : detail.state.status === "error" ? (
        <EmptyState title="Couldn't open this find" detail={detail.state.message} />
      ) : (
        <Body data={detail.state.data} />
      )}
    </Screen>
  );
}

function Body({ data }: { data: DetailData }) {
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
    <>
      <Photo
        uri={product.images[0]?.url ?? stockImageFor(product.id)}
        style={{ width: "100%", aspectRatio: 1, borderRadius: tokens.radii.cardLarge }}
      />
      <View style={{ gap: tokens.spacing.md, marginTop: tokens.spacing.xl }}>
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
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 10, paddingVertical: tokens.spacing.md }}
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
          <>
            <AppText bold>Description</AppText>
            <AppText muted>{product.description}</AppText>
          </>
        ) : null}
        {more.length > 0 ? (
          <>
            <Section title="More from this seller" />
            <ProductGrid items={more} />
          </>
        ) : null}
      </View>
    </>
  );
}
