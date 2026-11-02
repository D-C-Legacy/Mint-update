import React from "react";
import { useWindowDimensions } from "react-native";
import { useSellerGate } from "../../hooks/useSellerGate";
import { SellerApply } from "./SellerApply";
import { SellHubMobile } from "./SellHubMobile";
import { SellerPortal } from "./SellerPortal.web";

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile Sell tab the app uses
// (`SellHubMobile`) — web on a phone-width browser must look like the app. At/above it, the old
// standalone "Your studio" page is replaced by the YouTube-Studio-style seller portal (founder
// voice memo, 18 Oct 2026 — see `SellerPortal.web.tsx`): Sell lands on the Dashboard pane;
// Go live / Orders / the rest live in the left rail, their panes swap without route hops.
// Same `useSellerGate` hook either way, same `SellerApply` for the not-yet-approved state.
// The former desktop `DesktopSellHub` (giant Go-live tile + two-panel split) is gone; only the
// native app keeps the mobile layout.
const DESKTOP_BREAKPOINT = 768;

export function SellHub() {
  const { width } = useWindowDimensions();
  const { seller, reload } = useSellerGate();
  if (width < DESKTOP_BREAKPOINT) return <SellHubMobile />;
  if (seller === "loading") return null;
  if (!seller || seller.status !== "APPROVED") return <SellerApply onApproved={reload} />;
  return <SellerPortal />;
}
