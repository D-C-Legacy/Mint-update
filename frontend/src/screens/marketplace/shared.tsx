import { ROUTES } from "../../constants/routes";
import React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { AppText, Avatar, EmptyState, Icon, ProductCard, s, type IconName } from "../../components";
import type { CardProduct, Category } from "../../api/catalog";
import type { ChannelSummary } from "../../api/channels";
import type { Async } from "../../api/use-async";
import { useApp } from "../../context";
import { colors, radii, spacing } from "../../theme";
import { stockImageFor } from "../../utils/stock-image";

// Category has no image field in the data model (03-DATA-MODEL.md), so presentation is mapped by
// slug in the frontend. CATEGORY_IMAGES below carries the real photos; CATEGORY_ICONS remains only
// as the fallback for any future top-level category that has no photo mapped yet. Note the slug
// key: the backend's real slug is "fashion-accessories" — an earlier "fashion" key here was stale
// and made Fashion silently render the generic grid glyph.
const CATEGORY_ICONS: Record<string, IconName> = {
  "fashion-accessories": "shirt-outline",
  electronics: "hardware-chip-outline",
  "home-living": "home-outline",
  "beauty-personal-care": "color-palette-outline",
  "collectibles-toys": "game-controller-outline",
  "sports-outdoors": "basketball-outline",
};

// Transparent "sticker" icons for the category pills, keyed by the backend's real top-level slugs
// from GET /v1/categories. Frontend-only static map — no Category.image schema field; adding or
// swapping an icon is an asset + rebuild change, not a data edit. Founder-sourced sticker-style
// illustrations with real alpha transparency (replaces the earlier full-bleed stock photos).
const CATEGORY_IMAGES: Record<string, number> = {
  "fashion-accessories": require("../../../assets/categories/fashion-accessories.png"),
  electronics: require("../../../assets/categories/electronics.png"),
  "home-living": require("../../../assets/categories/home-living.png"),
  "beauty-personal-care": require("../../../assets/categories/beauty-personal-care.png"),
  "collectibles-toys": require("../../../assets/categories/collectibles-toys.png"),
  "sports-outdoors": require("../../../assets/categories/sports-outdoors.png"),
};

// Slim horizontal pill cards — icon plus a title, all inside one rounded
// container — not the squarer "icon on top, caption below" shape tried before. "All" isn't one of
// these any more; it's a top-right action on the "Categories" section heading instead (see
// Discover.tsx), so this row only ever holds real categories.
export function CategoryRow({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingVertical: spacing.sm }}
    >
      {categories.map((category) => {
        const selected = value === category.name;
        const photo = CATEGORY_IMAGES[category.slug];
        return (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(category.name)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.md,
              backgroundColor: selected ? colors.brand : colors.softCanvas,
            }}
          >
            {photo ? (
              // Transparent sticker icon in place of the glyph — "contain" so the whole icon shows
              // instead of being cropped like the old full-bleed photos were; tint backing shows
              // through the icon's own transparent padding.
              <Image
                source={photo}
                resizeMode="contain"
                style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.canvas }}
              />
            ) : (
              <Icon
                name={CATEGORY_ICONS[category.slug] || "grid-outline"}
                size={22}
                color={selected ? colors.canvas : colors.brand}
              />
            )}
            <AppText
              size={12}
              bold
              numberOfLines={1}
              style={{ color: selected ? colors.canvas : colors.text }}
            >
              {category.name}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function ProductGrid({ items }: { items: CardProduct[] }) {
  const app = useApp();
  return items.length ? (
    <View style={s.grid}>
      {items.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onPress={() => app.navigate(ROUTES.PRODUCT, product.id)}
        />
      ))}
    </View>
  ) : (
    <EmptyState title="No finds yet" detail="Try another category or check back soon." />
  );
}

// The product grid for a loading request: shows loading, error, or the cards.
export function AsyncProductGrid({
  state,
  keep,
}: {
  state: Async<CardProduct[]>;
  keep?: (product: CardProduct) => boolean;
}) {
  if (state.status === "loading") return <AppText muted>Loading finds…</AppText>;
  if (state.status === "error") return <EmptyState title="Couldn't load finds" detail={state.message} />;
  return <ProductGrid items={keep ? state.data.filter(keep) : state.data} />;
}

export function SellerList({ state }: { state: Async<ChannelSummary[]> }) {
  const app = useApp();
  if (state.status === "loading") return <AppText muted>Loading sellers…</AppText>;
  if (state.status === "error") return <EmptyState title="Couldn't load sellers" detail={state.message} />;
  if (state.data.length === 0) {
    return <EmptyState title="No sellers yet" detail="Sellers appear here once they go live." />;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 22 }}>
      {state.data.map((channel) => (
        <Pressable
          key={channel.id}
          onPress={() => app.navigate(ROUTES.SELLER, channel.slug)}
          style={{ alignItems: "center", gap: 6, width: 100 }}
        >
          <Avatar uri={channel.bannerUrl ?? stockImageFor(channel.id)} size={62} />
          <AppText size={12} bold>
            {channel.name}
          </AppText>
          <AppText size={10} muted>
            {channel.followerCount} followers
          </AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}
