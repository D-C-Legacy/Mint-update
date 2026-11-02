import * as tokens from "../../theme";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { AppText, EmptyState, Photo, SearchBar } from "../../components";
import { colors as c, spacing, formatUSD } from "../../theme";
import { ROUTES } from "../../constants/routes";
import { useApp } from "../../context";
import { Search as SearchMobile } from "./SearchMobile";
import {
  CONDITION_LABELS,
  listProducts,
  listCategories,
  toCards,
  type CardProduct,
  type Category,
} from "../../api/catalog";
import { listChannels, type ChannelSummary } from "../../api/channels";
import { useAsync } from "../../api/use-async";
import { InitialsAvatar } from "../../components/live/InitialsAvatar";

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile Search page the app uses.
// At/above it, a bespoke desktop layout: compact wrapping filter chips in a sidebar (the shared
// `Chips` component is a phone-sized horizontal scroller — unusable as desktop filter controls),
// real server-side search (`q`) and server-side category children expansion, client-side
// condition refinement and sorting, and a 4-up product grid sized like the desktop Discover grid.
const DESKTOP_BREAKPOINT = 768;

type SortKey = "relevance" | "price_asc" | "price_desc" | "newest" | "followers";

const PRODUCT_SORTS: { label: string; key: SortKey }[] = [
  { label: "Relevance", key: "relevance" },
  { label: "Lowest price", key: "price_asc" },
  { label: "Highest price", key: "price_desc" },
  { label: "Newest", key: "newest" },
];

const SELLER_SORTS: { label: string; key: SortKey }[] = [
  { label: "Relevance", key: "relevance" },
  { label: "Most followers", key: "followers" },
  { label: "Newest", key: "newest" },
];

const CONDITIONS = ["All", ...Object.values(CONDITION_LABELS)];

export function Search() {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT) return <SearchMobile />;
  return <DesktopSearch />;
}

function DesktopSearch() {
  const app = useApp();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tab, setTab] = useState<"Products" | "Sellers">("Products");
  const [condition, setCondition] = useState<string>("All");
  const [sortBy, setSortBy] = useState<SortKey>("relevance");
  const [categoryName, setCategoryName] = useState<string | null>(null);

  // Wait for a pause in typing before asking the API — same 300 ms window as the mobile hook.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const categoriesState = useAsync(listCategories, []);
  const categories: Category[] = categoriesState.state.status === "ready" ? categoriesState.state.data : [];
  const categoryNames = ["All", ...categories.map((cat) => cat.name)];

  // Server-side search. "All" browses the whole catalog; a top-level category searches all of its
  // children too (same expansion rule as loadCardsForCategory in catalog.ts).
  const products = useAsync(
    async () => {
      const targets =
        categoryName === null
          ? [undefined]
          : (() => {
              const picked = categories.find((cat) => cat.name === categoryName);
              const children = categories.filter((x) => x.parentId === picked?.id).map((x) => x.id);
              if (picked && children.length > 0) return children;
              return [picked?.id];
            })();
      const pages = await Promise.all(
        targets.map((id) =>
          listProducts({ categoryId: id, q: debounced || undefined, limit: 60 }),
        ),
      );
      const seen = new Set<string>();
      const cards: CardProduct[] = [];
      for (const page of pages) {
        for (const card of await toCards(page.items)) {
          if (!seen.has(card.id)) {
            seen.add(card.id);
            cards.push(card);
          }
        }
      }
      return cards;
    },
    [debounced, categoryName, categories],
  );

  const sellersState = useAsync(() => listChannels({ limit: 60 }), []);

  const results = useMemo(() => {
    if (products.state.status !== "ready") return products.state;
    let items = [...products.state.data];
    if (condition !== "All") items = items.filter((p) => p.detail === condition);
    switch (sortBy) {
      case "price_asc":
        // Products without a live sale (price null) sort to the end, not to the front.
        items.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
        break;
      case "price_desc":
        items.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
        break;
      case "newest":
        items.sort((a, b) => b.id.localeCompare(a.id)); // ULIDs sort by creation time
        break;
      default:
        break; // relevance / followers — keep the API's order
    }
    return { status: "ready" as const, data: items };
  }, [products.state, condition, sortBy]);

  const sellerResults = useMemo(() => {
    if (sellersState.state.status !== "ready") return sellersState.state;
    const q = debounced.toLowerCase();
    let items = sellersState.state.data.items.filter(
      (channel: ChannelSummary) =>
        q === "" ||
        channel.name.toLowerCase().includes(q) ||
        (channel.bio ?? "").toLowerCase().includes(q),
    );
    switch (sortBy) {
      case "followers":
        items = [...items].sort((a, b) => b.followerCount - a.followerCount);
        break;
      case "newest":
        items = [...items].sort((a, b) => b.id.localeCompare(a.id));
        break;
      default:
        break;
    }
    return { status: "ready" as const, data: items };
  }, [sellersState.state, debounced, sortBy]);

  const countText = tab === "Products"
    ? results.status === "ready"
      ? `${results.data.length} product${results.data.length === 1 ? "" : "s"}`
      : ""
    : sellerResults.status === "ready"
      ? `${sellerResults.data.length} seller${sellerResults.data.length === 1 ? "" : "s"}`
      : "";

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.xl, paddingBottom: tokens.spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ width: "100%", maxWidth: 1240, alignSelf: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <AppText size={26} bold>
            Search
          </AppText>
          <AppText size={13} muted>
            {countText}
          </AppText>
        </View>

        <View style={{ maxWidth: 620 }}>
          <SearchBar value={query} onChange={setQuery} />
        </View>

        {/* Segmented Products/Sellers switch — compact pills, not the phone-sized Chips */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: tokens.spacing.xs }}>
          {(["Products", "Sellers"] as const).map((name) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === name }}
              onPress={() => setTab(name)}
              style={({ pressed }) => ({
                paddingVertical: 7,
                paddingHorizontal: 18,
                borderRadius: 999,
                backgroundColor: tab === name ? c.ink : c.softCanvas,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <AppText size={13} bold={tab === name} white={tab === name}>
                {name}
              </AppText>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 32, marginTop: tokens.spacing.lg }}>
          {/* Filter sidebar */}
          <View style={{ width: 200, flexShrink: 0 }}>
            {tab === "Products" ? (
              <>
                <ChipGroup label="Condition">
                  {CONDITIONS.map((label) => (
                    <FilterChip key={label} label={label} active={condition === label} onPress={() => setCondition(label)} />
                  ))}
                </ChipGroup>
                <ChipGroup label="Category">
                  {categoryNames.map((name) => (
                    <FilterChip
                      key={name}
                      label={name}
                      active={(categoryName ?? "All") === name}
                      onPress={() => setCategoryName(name === "All" ? null : name)}
                    />
                  ))}
                </ChipGroup>
                <ChipGroup label="Sort by">
                  {PRODUCT_SORTS.map((sort) => (
                    <FilterChip key={sort.key} label={sort.label} active={sortBy === sort.key} onPress={() => setSortBy(sort.key)} />
                  ))}
                </ChipGroup>
              </>
            ) : (
              <ChipGroup label="Sort by">
                {SELLER_SORTS.map((sort) => (
                  <FilterChip key={sort.key} label={sort.label} active={sortBy === sort.key} onPress={() => setSortBy(sort.key)} />
                ))}
              </ChipGroup>
            )}
          </View>

          {/* Results */}
          <View style={{ flex: 1 }}>
            {tab === "Products" ? (
              products.state.status === "loading" ? (
                <AppText muted>Loading products…</AppText>
              ) : products.state.status === "error" ? (
                <EmptyState title="Couldn't load products" detail={products.state.message} />
              ) : results.status === "ready" && results.data.length === 0 ? (
                <EmptyState
                  title="No products found"
                  detail={query ? `Nothing matches "${query}" in ${categoryName === null ? "any category" : categoryName}.` : "Try another search."}
                />
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
                  {results.status === "ready" &&
                    results.data.map((product) => (
                      <ProductTile key={product.id} product={product} onPress={() => app.navigate(ROUTES.PRODUCT, product.id)} />
                    ))}
                </View>
              )
            ) : sellersState.state.status === "loading" ? (
              <AppText muted>Loading sellers…</AppText>
            ) : sellersState.state.status === "error" ? (
              <EmptyState title="Couldn't load sellers" detail={sellersState.state.message} />
            ) : sellerResults.status === "ready" && sellerResults.data.length === 0 ? (
              <EmptyState title="No sellers match" detail={query ? `No sellers match "${query}"` : "Try another search."} />
            ) : (
              sellerResults.status === "ready" &&
              sellerResults.data.map((channel) => (
                <Pressable
                  key={channel.id}
                  accessibilityRole="button"
                  onPress={() => app.navigate(ROUTES.SELLER, channel.slug)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    paddingVertical: 12,
                    paddingHorizontal: tokens.spacing.md,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: c.line,
                    backgroundColor: pressed ? c.softCanvas : c.canvas,
                    marginBottom: 10,
                  })}
                >
                  <InitialsAvatar name={channel.name} size={44} />
                  <View style={{ flex: 1 }}>
                    <AppText size={14} bold>
                      {channel.name}
                    </AppText>
                    <AppText size={12} muted numberOfLines={1}>
                      {channel.bio ?? "No bio yet"}
                    </AppText>
                  </View>
                  <AppText size={12} muted>
                    {channel.followerCount} follower{channel.followerCount === 1 ? "" : "s"}
                  </AppText>
                </Pressable>
              ))
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// Compact sidebar filter chip — 24px tall, wraps instead of horizontal-scrolling.
function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? c.brand : c.line,
        backgroundColor: active ? c.brand : c.canvas,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <AppText size={12} bold={active} white={active} muted={!active}>
        {label}
      </AppText>
    </Pressable>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8, marginBottom: tokens.spacing.lg }}>
      <AppText size={11} muted style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
        {label}
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>
    </View>
  );
}

// Desktop product tile — same data and detail treatment as the shared ProductCard, but sized for
// the desktop grid (4-up at "23%" width, matching StreamCardDesktop's sizing rule) instead of
// ProductCard's hardcoded mobile "48%".
function ProductTile({ product, onPress }: { product: CardProduct; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`View ${product.title}`}
      style={({ pressed }) => ({
        width: "23%",
        marginBottom: tokens.spacing.lg,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View
        style={{
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: c.canvas,
          borderWidth: 1,
          borderColor: c.line,
        }}
      >
        <Photo uri={product.image} style={{ width: "100%", aspectRatio: 1 }} />
        <View style={{ padding: tokens.spacing.sm }}>
          <AppText size={13} bold numberOfLines={2}>
            {product.title}
          </AppText>
          <AppText size={15} bold style={{ marginTop: 2 }}>
            {product.price === null ? "Not for sale" : formatUSD(product.price)}
          </AppText>
          <AppText muted size={11} numberOfLines={1}>
            {product.detail}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}
