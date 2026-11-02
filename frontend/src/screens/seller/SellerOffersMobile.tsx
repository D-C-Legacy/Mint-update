import React, { useCallback, useEffect, useState } from "react";
import { AppText, Chips, EmptyState, IconButton, Screen } from "../../components";
import { useApp } from "../../hooks";
import {
  listSellerOffers,
  type SellerOffer,
  type RespondToOfferResult,
} from "../../api/sales";
import { describeApiError } from "../../api/describe-error";
import { SellerOfferCard, type OfferResponded } from "./SellerOfferCard";

// Two views over the same GET /seller/offers route: "Pending" (the actionable inbox — the
// route's own default when no status param is passed, user decision 17 Oct 2026) and "History"
// (the explicit statuses list for everything already responded/expired).
export const SELLER_OFFER_TABS: Array<{ label: string; statuses: string[] | undefined }> = [
  { label: "Pending", statuses: undefined },
  { label: "History", statuses: ["ACCEPTED", "REJECTED", "COUNTERED", "EXPIRED", "WITHDRAWN"] },
];

// The app's own seller offers list (mobile). The web build has its own master-detail layout
// (`SellerOffers.web.tsx`); this file is the single source of truth for the mobile layout, reused
// by the web narrow-width path. No WS push for incoming offers exists (a new backend event, not
// built) — per the user's 17 Oct 2026 call this screen reloads on entry and on the Refresh
// button, like Orders.
//
// The content (chips + cards) is also reused inside the seller portal's Offers pane
// (`SellerPortal.web.tsx`, desktop web) — the body lives in `SellerOffersContent` (self-loading;
// it refetches whenever it mounts, i.e. every time its pane opens) and the `Screen` chrome stays
// the wrapper of the mobile/narrow-web path, whose header Refresh button remounts the content.
export function SellerOffers() {
  const app = useApp();
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <Screen
      title="Offers"
      onBack={app.back}
      right={<IconButton name="refresh" label="Refresh offers" onPress={() => setRefreshKey((k) => k + 1)} />}
    >
      <SellerOffersContent key={refreshKey} />
    </Screen>
  );
}

export function SellerOffersContent() {
  const [tab, setTab] = useState("Pending");
  const [offers, setOffers] = useState<SellerOffer[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

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
        // A responded offer is no longer pending — the server list wouldn't return it on the next
        // load either, so removing the row keeps the screen honest instead of showing a card
        // whose actions are gone.
        return prev.filter((o) => o.id !== result.offerId);
      }
      return prev.map((o) =>
        o.id === result.offerId
          ? { ...o, status: result.status, counterAmount: result.counterAmount }
          : o,
      );
    });
  };

  return (
    <>
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
        offers.map((offer) => <SellerOfferCard key={offer.id} offer={offer} onResponded={onResponded} />)
      )}
    </>
  );
}
