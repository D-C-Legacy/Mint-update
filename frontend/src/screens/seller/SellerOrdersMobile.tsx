import React, { useEffect, useState } from "react";
import { AppText, Chips, EmptyState, Screen } from "../../components";
import { useApp } from "../../hooks";
import { listSellerOrders } from "../../api/seller-orders";
import { type OrderStatus, type OrderView } from "../../api/orders";
import { describeApiError } from "../../api/describe-error";
import { SellerOrderCard } from "./SellerOrderCard";

export const SELLER_ORDER_TABS: Array<{ label: string; status: OrderStatus | undefined }> = [
  { label: "All", status: undefined },
  { label: "Paid", status: "PAID" },
  { label: "Shipped", status: "SHIPPED" },
  { label: "Delivered", status: "DELIVERED" },
];

// The app's own seller orders list (mobile). The web build has its own master-detail layout
// (`SellerOrders.web.tsx`); this file is the single source of truth for the mobile layout, reused by
// the web narrow-width path.
//
// The content (chips + cards) is also reused inside the seller portal's Orders pane
// (`SellerPortal.web.tsx`, desktop web) — so the body lives in `SellerOrdersContent` and the
// `Screen` chrome stays the wrapper of the mobile/narrow-web path only.
export function SellerOrders() {
  const app = useApp();
  return (
    <Screen title="Orders" onBack={app.back}>
      <SellerOrdersContent />
    </Screen>
  );
}

export function SellerOrdersContent() {
  const [tab, setTab] = useState("All");
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const filter = SELLER_ORDER_TABS.find((t) => t.label === tab);
    let alive = true;
    setStatus("loading");
    listSellerOrders({ status: filter?.status, limit: 50 })
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

  const replaceOrder = (updated: OrderView) => setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

  return (
    <>
      <Chips items={SELLER_ORDER_TABS.map((t) => t.label)} value={tab} onChange={setTab} />
      {status === "loading" ? (
        <AppText muted>Loading…</AppText>
      ) : status === "error" ? (
        <EmptyState title="Couldn't load orders" detail={error} />
      ) : orders.length === 0 ? (
        <EmptyState title="No orders yet" detail="Orders for your items show up here." />
      ) : (
        orders.map((order) => <SellerOrderCard key={order.id} order={order} onShipped={replaceOrder} />)
      )}
    </>
  );
}
