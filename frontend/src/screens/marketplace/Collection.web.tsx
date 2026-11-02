import * as tokens from "../../theme";
import React, { useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { AppText, Button, EmptyState, Screen, s } from "../../components";
import { colors as c } from "../../theme";
import { ROUTES } from "../../constants/routes";
import { useApp } from "../../context";
import { useMyBidsList } from "../../hooks/useMyBidsList";
import { Collection as CollectionMobile } from "./CollectionMobile";

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile Collection the app uses
// (`CollectionMobile`) — Bids & Offers only now (28 Oct 2026), see that file's own comment. At/above
// it, Bids & Offers becomes a master-detail pair (list left, selected-item preview right), like
// Orders — founder feedback 16 Oct 2026: split every remaining page like the Seller studio.
const DESKTOP_BREAKPOINT = 768;

export function Collection() {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT) return <CollectionMobile />;
  return <DesktopBids />;
}

function DesktopBids() {
  const app = useApp();
  const { rows, status, error } = useMyBidsList();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((row) => row.bid.id === selectedId) ?? null;

  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ flex: 1, borderRightWidth: 1, borderColor: c.line }}>
        <Screen title="Bids & Offers" onBack={app.back}>
          {status === "loading" ? (
            <AppText muted>Loading your bids…</AppText>
          ) : status === "error" ? (
            <EmptyState title="Couldn't load your bids" detail={error} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No bids yet"
              detail="Bids you place on live auctions show here."
              onPress={() => app.navigate(ROUTES.DISCOVER)}
            />
          ) : (
            rows.map((row) => (
              <Pressable
                key={row.bid.id}
                accessibilityRole="button"
                accessibilityLabel={row.title}
                onPress={() => setSelectedId(row.bid.id)}
                style={[
                  s.row,
                  {
                    gap: tokens.spacing.md,
                    paddingVertical: tokens.spacing.lg,
                    borderBottomWidth: 1,
                    borderColor: c.line,
                    backgroundColor: selectedId === row.bid.id ? c.softCanvas : "transparent",
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <AppText bold>{row.title}</AppText>
                  <AppText muted size={13}>
                    {`$${(row.bid.amount / 100).toFixed(2)} · ${row.status}`}
                  </AppText>
                </View>
              </Pressable>
            ))
          )}
        </Screen>
      </View>

      <View style={{ flex: 1 }}>
        {selected ? (
          <ScrollView contentContainerStyle={{ padding: tokens.spacing.xl, gap: tokens.spacing.md }}>
            <AppText size={22} bold>
              {selected.title}
            </AppText>
            <AppText muted>{`Your bid · $${(selected.bid.amount / 100).toFixed(2)}`}</AppText>
            <AppText bold>{selected.status}</AppText>
            {selected.productId ? (
              <Button
                label="View product"
                onPress={() => app.navigate(ROUTES.PRODUCT, selected.productId ?? undefined)}
              />
            ) : null}
          </ScrollView>
        ) : (
          <View style={{ padding: tokens.spacing.xl }}>
            <AppText muted>Select a bid to preview.</AppText>
          </View>
        )}
      </View>
    </View>
  );
}
