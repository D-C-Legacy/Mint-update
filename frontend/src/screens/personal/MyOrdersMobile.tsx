import React from "react";
import { AppText, Button, EmptyState, MenuRow, Screen } from "../../components";
import { dollars, ORDER_STATUS_LABEL } from "../../api/orders";
import { ROUTES } from "../../constants/routes";
import { useApp } from "../../context";
import { useOrdersList } from "../../hooks/useOrdersList";

// The app's own purchases list. The web build has its own master-detail layout
// (`MyOrders.web.tsx`); this file is the single source of truth for the mobile layout, reused by the
// web narrow-width path. Data comes from the shared `useOrdersList` hook.
export function MyOrders() {
  const app = useApp();
  const { orders, titles, nextCursor, status, error, loadingMore, loadMore } = useOrdersList();

  return (
    <Screen title="Purchases" onBack={app.back}>
      {status === "loading" ? (
        <AppText muted>Loading your purchases…</AppText>
      ) : status === "error" ? (
        <EmptyState title="Couldn't load purchases" detail={error} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No purchases yet"
          detail="Items you win or buy show up here."
          onPress={() => app.navigate(ROUTES.DISCOVER)}
        />
      ) : (
        <>
          {orders.map((order) => (
            <MenuRow
              key={order.id}
              title={titles[order.saleId] ?? "Order item"}
              detail={`${dollars(order.totalAmount)} · ${ORDER_STATUS_LABEL[order.status]}`}
              onPress={() => app.navigate(ROUTES.ORDER, order.id)}
            />
          ))}
          {nextCursor ? <Button secondary label="Load more" loading={loadingMore} onPress={loadMore} /> : null}
        </>
      )}
    </Screen>
  );
}
