import * as tokens from "../../theme";
import React, { useCallback, useEffect, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { AppText, Chips, EmptyState, IconButton, Screen } from "../../components";
import { colors as c } from "../../theme";
import { useApp } from "../../hooks";
import { listSellerOffers, type SellerOffer, type RespondToOfferResult } from "../../api/sales";
import { describeApiError } from "../../api/describe-error";
import { SellerOfferCard, SellerOfferRow, type OfferResponded } from "./SellerOfferCard";
import { SELLER_OFFER_TABS, SellerOffers as SellerOffersMobile } from "./SellerOffersMobile";

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile offers list the app uses
// (`SellerOffersMobile`). At/above it, the list and the selected offer become a master-detail
// pair (the SellerOrders.web.tsx treatment): light offer rows left (selected highlighted), the
// full offer card with its respond actions right.
const DESKTOP_BREAKPOINT = 768;

export function SellerOffers() {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT) return <SellerOffersMobile />;
  return <DesktopSellerOffers />;
}

function DesktopSellerOffers() {
  const app = useApp();
  const [tab, setTab] = useState("Pending");
  const [offers, setOffers] = useState<SellerOffer[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = offers.find((offer) => offer.id === selectedId) ?? null;

  const load = useCallback(() => {
    const filter = SELLER_OFFER_TABS.find((t) => t.label === tab);
    let alive = true;
    setStatus("loading");
    listSellerOffers({ statuses: filter?.statuses, limit: 50 })
      .then((page) => {
        if (!alive) return;
        setOffers(page.items);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setError(describeApiError(err));
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [tab]);

  useEffect(() => {
    const cancel = load();
    return () => cancel?.();
  }, [load]);

  const onResponded: OfferResponded = (result: RespondToOfferResult) => {
    setOffers((prev) => {
      if (tab === "Pending") {
        // A responded offer is no longer pending — removing the row matches what the server
        // list would return next load, and selection clears below via the filter above.
        return prev.filter((o) => o.id !== result.offerId);
      }
      return prev.map((o) =>
        o.id === result.offerId
          ? { ...o, status: result.status, counterAmount: result.counterAmount }
          : o,
      );
    });
    if (selectedId === result.offerId && tab === "Pending") setSelectedId(null);
  };

  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ flex: 1 }}>
        <Screen
          title="Offers"
          onBack={app.back}
          right={<IconButton name="refresh" label="Refresh offers" onPress={load} />}
        >
          <Chips items={SELLER_OFFER_TABS.map((t) => t.label)} value={tab} onChange={setTab} />
          {status === "loading" ? (
            <AppText muted>Loading…</AppText>
          ) : status === "error" ? (
            <EmptyState title="Couldn't load offers" detail={error} />
          ) : offers.length === 0 ? (
            <EmptyState
              title={tab === "Pending" ? "No pending offers" : "No history yet"}
              detail={
                tab === "Pending"
                  ? "When buyers make an offer on your items, it shows up here."
                  : "Offers you've accepted, rejected, or countered land here."
              }
            />
          ) : (
            offers.map((offer) => (
              <SellerOfferRow
                key={offer.id}
                offer={offer}
                selected={selectedId === offer.id}
                onPress={() => setSelectedId(offer.id)}
              />
            ))
          )}
        </Screen>
      </View>

      <View style={{ flex: 1, borderLeftWidth: 1, borderColor: c.line }}>
        {selected ? (
          <Screen title="Offer">
            <SellerOfferCard offer={selected} onResponded={onResponded} />
          </Screen>
        ) : (
          <View style={{ padding: tokens.spacing.xl }}>
            <AppText muted>Select an offer to see the details.</AppText>
          </View>
        )}
      </View>
    </View>
  );
}
