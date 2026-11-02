import React, { useState } from "react";
import { AppText, Chips, EmptyState, MenuRow, Screen, SearchBar } from "../../components";
import { ROUTES } from "../../constants/routes";
import { useApp } from "../../context";
import { AsyncProductGrid } from "./shared";
import { useSearch } from "../../hooks/useSearch";

// The app's own Search (mobile). The web build has its own 2-column layout (`Search.web.tsx`); this
// file is the single source of truth for the mobile layout, reused by the web narrow-width path.
export function Search() {
  const app = useApp();
  const { query, setQuery, tab, setTab, condition, setCondition, products, sellers, sellerMatches } =
    useSearch();

  const [sortBy, setSortBy] = useState<"relevance" | "price_asc" | "price_desc" | "newest">("relevance");

  return (
    <Screen title="Search" onBack={app.back}>
      <SearchBar value={query} onChange={setQuery} />
      <Chips items={["Products", "Sellers"]} value={tab} onChange={setTab} />
      {tab === "Products" ? (
        <>
          <Chips items={["All", "New"]} value={condition} onChange={setCondition} />
          <Chips
            items={["Relevance", "Price: Low to High", "Price: High to Low", "Newest"]}
            value={
              sortBy === "relevance" ? "Relevance" :
              sortBy === "price_asc" ? "Price: Low to High" :
              sortBy === "price_desc" ? "Price: High to Low" : "Newest"
            }
            onChange={(v) =>
              setSortBy(
                (
                  {
                    Relevance: "relevance",
                    "Price: Low to High": "price_asc",
                    "Price: High to Low": "price_desc",
                    Newest: "newest",
                  } as Record<string, "relevance" | "price_asc" | "price_desc" | "newest">
                )[v] ?? "relevance",
              )
            }
          />
          <AsyncProductGrid
            state={products.state}
            keep={(product) => condition === "All" || product.detail === "New"}
          />
        </>
      ) : sellers.state.status === "loading" ? (
        <AppText muted>Loading sellers…</AppText>
      ) : sellers.state.status === "error" ? (
        <EmptyState title="Couldn't load sellers" detail={sellers.state.message} />
      ) : sellerMatches.length === 0 ? (
        <EmptyState title="No sellers match" detail="Try another search." />
      ) : (
        sellerMatches.map((channel) => (
          <MenuRow
            key={channel.id}
            title={channel.name}
            detail={channel.bio ?? `${channel.followerCount} followers`}
            onPress={() => app.navigate(ROUTES.SELLER, channel.slug)}
          />
        ))
      )}
    </Screen>
  );
}
