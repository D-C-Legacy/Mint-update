import * as tokens from "../../theme";
import React, { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { AppText, EmptyState, Screen, s } from "../../components";
import { colors as c } from "../../theme";
import { dollars, ORDER_STATUS_LABEL } from "../../api/orders";
import { ROUTES } from "../../constants/routes";
import { useApp } from "../../context";
import { useOrdersList } from "../../hooks/useOrdersList";
import { MyOrderDetail } from "./MyOrderDetail";
import { MyOrders as MyOrdersMobile } from "./MyOrdersMobile";

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile purchases list the app uses
// (`MyOrdersMobile`) — web on a phone-width browser must look like the app. At/above it, the list and
// the detail become a master-detail pair (founder feedback 16 Oct 2026: split every remaining page
// like the Seller studio): orders left, the selected order's detail right. Selecting a row shows the
// detail inline rather than pushing a route, so the list stays visible.
const DESKTOP_BREAKPOINT = 768;

export function MyOrders() {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT) return <MyOrdersMobile />;
  return <DesktopOrders />;
}

function DesktopOrders() {
  const app = useApp();
  const { orders, titles, status, error } = useOrdersList();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = orders.find((o) => o.id === selectedId) ?? null;

  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ flex: 1, borderRightWidth: 1, borderColor: c.line }}>
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
            orders.map((order) => (
              <Pressable
                key={order.id}
                accessibilityRole="button"
                accessibilityLabel={`Order ${order.id}`}
                onPress={() => setSelectedId(order.id)}
                style={[
                  s.row,
                  {
                    gap: tokens.spacing.md,
                    paddingVertical: tokens.spacing.lg,
                    borderBottomWidth: 1,
                    borderColor: c.line,
                    backgroundColor: selectedId === order.id ? c.softCanvas : "transparent",
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <AppText bold>{titles[order.saleId] ?? "Order item"}</AppText>
                  <AppText muted size={13}>
                    {`${dollars(order.totalAmount)} · ${ORDER_STATUS_LABEL[order.status]}`}
                  </AppText>
                </View>
              </Pressable>
            ))
          )}
        </Screen>
      </View>

      <View style={{ flex: 1 }}>
        {selected ? (
          <MyOrderDetail id={selected.id} inline />
        ) : (
          <View style={{ padding: tokens.spacing.xl }}>
            <AppText muted>Select an order to see the details.</AppText>
          </View>
        )}
      </View>
    </View>
  );
}
