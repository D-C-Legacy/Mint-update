import * as tokens from "../../theme";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { AppText, Badge, Button, Field, s } from "../../components";
import { colors as c } from "../../theme";
import { useApp } from "../../hooks";
import { shipOrder } from "../../api/seller-orders";
import { dollars, ORDER_STATUS_LABEL, type OrderView } from "../../api/orders";
import { describeApiError } from "../../api/describe-error";

// Shared seller-order renderers, used by both the mobile list and the desktop master-detail (list
// left, selected order right).

// A light list row: amount, order id, status. No ship form.
export function SellerOrderRow({
  order,
  selected,
  onPress,
}: {
  order: OrderView;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.id}`}
      onPress={onPress}
      style={[
        s.row,
        {
          gap: tokens.spacing.md,
          paddingVertical: tokens.spacing.lg,
          borderBottomWidth: 1,
          borderColor: c.line,
          backgroundColor: selected ? c.softCanvas : "transparent",
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <AppText bold>{dollars(order.totalAmount)}</AppText>
        <AppText muted size={12}>
          Order {order.id} · Placed {new Date(order.createdAt).toLocaleDateString()}
        </AppText>
      </View>
      <Badge label={ORDER_STATUS_LABEL[order.status]} />
    </Pressable>
  );
}

// The full order card: amount, status, tracking, and the inline ship form for PAID orders.
export function SellerOrderCard({
  order,
  onShipped,
}: {
  order: OrderView;
  onShipped: (updated: OrderView) => void;
}) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [working, setWorking] = useState(false);

  const run = async () => {
    if (!carrier.trim() || !tracking.trim()) {
      app.toast("Add a carrier and a tracking number.");
      return;
    }
    setWorking(true);
    try {
      const updated = await shipOrder(order.id, { carrier: carrier.trim(), trackingNumber: tracking.trim() });
      onShipped(updated);
      app.toast("Order marked shipped.");
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <View style={[s.card, { marginBottom: tokens.spacing.md, gap: 6 }]}>
      <View style={s.row}>
        <AppText bold>{dollars(order.totalAmount)}</AppText>
        <Badge label={ORDER_STATUS_LABEL[order.status]} />
      </View>
      <AppText muted size={12}>
        Order {order.id} · Placed {new Date(order.createdAt).toLocaleDateString()}
      </AppText>
      {order.trackingNumber ? (
        <AppText muted size={12}>
          {order.carrier} · Tracking {order.trackingNumber}
        </AppText>
      ) : null}
      {order.status === "PAID" ? (
        open ? (
          <View style={{ gap: tokens.spacing.sm, marginTop: tokens.spacing.sm }}>
            <Field label="Carrier" value={carrier} onChange={setCarrier} placeholder="UPS, FedEx..." />
            <Field label="Tracking number" value={tracking} onChange={setTracking} />
            <Button label="Confirm shipped" loading={working} onPress={run} />
          </View>
        ) : (
          <Button secondary label="Ship" onPress={() => setOpen(true)} />
        )
      ) : null}
    </View>
  );
}
