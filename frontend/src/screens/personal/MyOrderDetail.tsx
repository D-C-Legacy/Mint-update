import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, EmptyState, Field, Screen, Section } from "../../components";
import { ROUTES } from "../../constants";
import { getProduct } from "../../api/catalog";
import { getSale } from "../../api/sales";
import { describeApiError } from "../../api/describe-error";
import {
  cancelOrder,
  confirmDelivery,
  dollars,
  getMyOrder,
  ORDER_STATUS_LABEL,
  type OrderView,
} from "../../api/orders";
import { createReview, getMyReviewForOrder, updateReview, type ReviewView } from "../../api/reviews";
import { colors as c, spacing } from "../../theme";
import { useApp, useRealtime } from "../../hooks";

type Loaded = { order: OrderView; title: string };

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} star`} onPress={() => onChange(n)}>
          <Ionicons name={n <= value ? "star" : "star-outline"} size={28} color={c.brand} />
        </Pressable>
      ))}
    </View>
  );
}

function shippingAddressText(address: Record<string, unknown>) {
  const a = address as Record<string, string | undefined>;
  const street = [a.line1, a.line2].filter(Boolean).join(", ");
  return `${a.fullName ?? ""}\n${street}\n${a.city ?? ""}, ${a.region ?? ""} ${a.postalCode ?? ""}`;
}

// One order: status, amounts, the shipping address (set from checkout), and what is still missing.
// Payment happens in checkout. `inline` is the desktop master-detail mode: the list is already
// visible beside it, so the back button is dropped (the title stays as the column header).
export function MyOrderDetail({ id, inline = false }: { id?: string; inline?: boolean }) {
  const app = useApp();
  const realtime = useRealtime();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [working, setWorking] = useState(false);
  const [review, setReview] = useState<ReviewView | null>(null);
  const [editingReview, setEditingReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  const load = () => {
    let alive = true;
    (async () => {
      try {
        const order = await getMyOrder(id ?? "");
        const sale = await getSale(order.saleId);
        const product = await getProduct(sale.productId);
        if (alive) setLoaded({ order, title: product.title });
        if (order.status === "DELIVERED" || order.status === "COMPLETED") {
          const existing = await getMyReviewForOrder(order.id);
          if (alive && existing) {
            setReview(existing);
            setRating(existing.rating);
            setReviewBody(existing.body ?? "");
          }
        }
      } catch (err) {
        if (alive) setError(describeApiError(err));
      }
    })();
    return () => {
      alive = false;
    };
  };

  useEffect(load, [id]);

  // Live: a push for this exact order (seller ships it, auto-confirm fires, etc.) refetches
  // instead of waiting for the next time this screen is opened.
  useEffect(() => {
    return realtime.on("order.status.changed", (payload) => {
      const p = payload as { orderId?: string };
      if (p.orderId === id) load();
    });
  }, [realtime, id]);

  if (error) {
    return (
      <Screen title="Order" onBack={inline ? undefined : app.back}>
        <EmptyState title="Couldn't open this order" detail={error} />
      </Screen>
    );
  }
  if (!loaded) {
    return (
      <Screen title="Order" onBack={inline ? undefined : app.back}>
        <AppText muted>Loading…</AppText>
      </Screen>
    );
  }

  const { order, title } = loaded;
  const hasAddress = Object.keys(order.shippingAddress).length > 0;
  const canEditAddress = order.status === "PENDING_PAYMENT" || order.status === "PAID";
  const canCancel = order.status === "PENDING_PAYMENT";
  const canConfirmDelivery = order.status === "SHIPPED";

  const runCancel = async () => {
    setWorking(true);
    try {
      const updated = await cancelOrder(order.id);
      setLoaded({ order: updated, title });
      setConfirmingCancel(false);
      app.toast("Order cancelled.");
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setWorking(false);
    }
  };

  const runConfirmDelivery = async () => {
    setWorking(true);
    try {
      const updated = await confirmDelivery(order.id);
      setLoaded({ order: updated, title });
      app.toast("Delivery confirmed.");
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setWorking(false);
    }
  };

  const runSaveReview = async () => {
    setSavingReview(true);
    try {
      const saved = review
        ? await updateReview(review.id, rating, reviewBody.trim() || undefined)
        : await createReview(order.id, rating, reviewBody.trim() || undefined);
      setReview(saved);
      setEditingReview(false);
      app.toast(review ? "Review updated." : "Thanks for your review.");
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setSavingReview(false);
    }
  };

  return (
    <Screen title="Order" onBack={inline ? undefined : app.back}>
      <AppText size={22} bold>{title}</AppText>
      <AppText bold>{ORDER_STATUS_LABEL[order.status]}</AppText>
      <AppText muted size={12}>
        Placed {new Date(order.createdAt).toLocaleDateString()} · Order {order.id}
      </AppText>
      {order.status === "CANCELLED" && order.cancelReason ? (
        <AppText muted size={13}>Reason: {order.cancelReason}</AppText>
      ) : null}

      <Section title="Amounts" />
      <AppText>Item {dollars(order.itemAmount)}</AppText>
      <AppText>Shipping {dollars(order.shippingAmount)}</AppText>
      <AppText>Tax {dollars(order.taxAmount)}</AppText>
      <AppText bold>Total {dollars(order.totalAmount)}</AppText>

      <Section title="Delivery" />
      {hasAddress ? (
        <AppText>{shippingAddressText(order.shippingAddress)}</AppText>
      ) : (
        <AppText muted>No shipping address yet.</AppText>
      )}
      {canEditAddress ? (
        <Button
          secondary={order.status !== "PENDING_PAYMENT"}
          label={
            order.status === "PENDING_PAYMENT"
              ? hasAddress
                ? "Review and pay"
                : "Checkout"
              : "Change shipping address"
          }
          onPress={() => app.navigate(ROUTES.ORDER_CHECKOUT, order.id)}
        />
      ) : null}
      {order.trackingNumber ? (
        <AppText muted>
          {order.carrier ? `${order.carrier} · ` : ""}Tracking {order.trackingNumber}
        </AppText>
      ) : null}
      {canConfirmDelivery ? (
        <Button label="Confirm delivery" loading={working} onPress={runConfirmDelivery} />
      ) : null}

      {order.status === "DELIVERED" || order.status === "COMPLETED" ? (
        <>
          <Section title="Your review" />
          {review && !editingReview ? (
            <View style={{ gap: spacing.sm }}>
              <AppText bold>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</AppText>
              {review.body ? <AppText>{review.body}</AppText> : null}
              {review.sellerResponseBody ? (
                <View style={{ marginTop: 4, paddingLeft: spacing.md, borderLeftWidth: 2, borderColor: c.line }}>
                  <AppText muted size={12} bold>
                    Seller response
                  </AppText>
                  <AppText size={13}>{review.sellerResponseBody}</AppText>
                </View>
              ) : null}
              <Button secondary label="Edit review" onPress={() => setEditingReview(true)} />
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <StarPicker value={rating} onChange={setRating} />
              <Field placeholder="Tell others about this order (optional)" value={reviewBody} onChange={setReviewBody} multiline />
              <Button label={review ? "Save review" : "Submit review"} loading={savingReview} onPress={runSaveReview} />
            </View>
          )}
        </>
      ) : null}

      {canCancel ? (
        <>
          <Section title="Cancel" />
          {confirmingCancel ? (
            <>
              <AppText>Cancel this order? This can't be undone.</AppText>
              <Button variant="danger" label="Cancel order" loading={working} onPress={runCancel} />
              <Button secondary label="Keep it" disabled={working} onPress={() => setConfirmingCancel(false)} />
            </>
          ) : (
            <Button variant="ghost" label="Cancel order" onPress={() => setConfirmingCancel(true)} />
          )}
        </>
      ) : null}
    </Screen>
  );
}
