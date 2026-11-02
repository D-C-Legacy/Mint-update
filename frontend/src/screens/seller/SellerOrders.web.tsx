import * as tokens from "../../theme";
import React, { useEffect, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { AppText, Chips, EmptyState, Screen } from "../../components";
import { colors as c } from "../../theme";
import { useApp } from "../../hooks";
import { listSellerOrders } from "../../api/seller-orders";
import { type OrderStatus, type OrderView } from "../../api/orders";
import { describeApiError } from "../../api/describe-error";
import { SellerOrderCard, SellerOrderRow } from "./SellerOrderCard";
import { SELLER_ORDER_TABS, SellerOrders as SellerOrdersMobile } from "./SellerOrdersMobile";

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile seller orders list the app uses
// (`SellerOrdersMobile`). At/above it, the list and the selected order become a master-detail pair
// (founder feedback 16 Oct 2026: split every remaining page like the Seller studio): light order
// rows left (selected highlighted), the full order card with its ship form right.
const DESKTOP_BREAKPOINT = 768;

export function SellerOrders() {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT) return <SellerOrdersMobile />;
  return <DesktopSellerOrders />;
}

function DesktopSellerOrders() {
  const app = useApp();
  const [tab, setTab] = useState("All");
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = orders.find((order) => order.id === selectedId) ?? null;

  useEffect(() => {
    const filter = SELLER_ORDER_TABS.find((t) => t.label === tab);
    let alive = true;
    setStatus("loading");
    listSellerOrders({ status: filter?.status as OrderStatus | undefined, limit: 50 })
      .then((page) => {
        if (!alive) return;
        setOrders(page.items);
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

  const replaceOrder = (updated: OrderView) =>
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ flex: 1 }}>
        <Screen title="Orders" onBack={app.back}>
          <Chips items={SELLER_ORDER_TABS.map((t) => t.label)} value={tab} onChange={setTab} />
          {status === "loading" ? (
            <AppText muted>Loading…</AppText>
          ) : status === "error" ? (
            <EmptyState title="Couldn't load orders" detail={error} />
          ) : orders.length === 0 ? (
            <EmptyState title="No orders yet" detail="Orders for your items show up here." />
          ) : (
            orders.map((order) => (
              <SellerOrderRow
                key={order.id}
                order={order}
                selected={selectedId === order.id}
                onPress={() => setSelectedId(order.id)}
              />
            ))
          )}
        </Screen>
      </View>

      <View style={{ flex: 1, borderLeftWidth: 1, borderColor: c.line }}>
        {selected ? (
          <Screen title="Order">
            <SellerOrderCard order={selected} onShipped={replaceOrder} />
          </Screen>
        ) : (
          <View style={{ padding: tokens.spacing.xl }}>
            <AppText muted>Select an order to see the details.</AppText>
          </View>
        )}
      </View>
    </View>
  );
}
