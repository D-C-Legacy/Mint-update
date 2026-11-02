import React from "react";
import { Screen } from "../../components";
import { useApp } from "../../context";
import { MyBidsList } from "./MyBidsList";

// The app's own Collection screen. Used for Bids & Offers only now (28 Oct 2026) — Saved/
// Following/Recently viewed were folded into AccountScreen's "Activity" section when Account was
// flattened out of its old Edit profile/Your Activity/Addresses/Security sub-navigation. The web
// build has its own two-column layout (`Collection.web.tsx`); this file is the single source of
// truth for the mobile layout, reused by the web narrow-width path.
export function Collection() {
  const app = useApp();
  return (
    <Screen title="Bids & Offers" onBack={app.back}>
      <MyBidsList />
    </Screen>
  );
}
