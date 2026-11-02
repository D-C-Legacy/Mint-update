import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { AppText, Button, EmptyState, Icon, Screen, Section } from "../../components";
import { AddressForm } from "../../components/commerce/AddressForm";
import { CardEntry } from "../../components/commerce/CardEntry";
import { useApp } from "../../hooks";
import { getProduct } from "../../api/catalog";
import { getSale } from "../../api/sales";
import { describeApiError } from "../../api/describe-error";
import { createAddress, listAddresses, type AddressFields, type SavedAddress } from "../../api/addresses";
import { dollars, getMyOrder, setOrderAddress, type OrderView } from "../../api/orders";
import { cardExpiry, cardLabel, listCards, newIdempotencyKey, payOrder, type SavedCard } from "../../api/payments";
import { formatAddress } from "../../utils/format-address";
import { colors, spacing } from "../../theme";

type Loaded = { order: OrderView; title: string; saved: SavedAddress[]; cards: SavedCard[] };

function hasAddress(order: OrderView) {
  return Object.keys(order.shippingAddress).length > 0;
}

function orderAddressText(order: OrderView) {
  const a = order.shippingAddress as Partial<AddressFields>;
  const street = [a.line1, a.line2].filter(Boolean).join(", ");
  return `${a.fullName ?? ""}\n${street}\n${a.city ?? ""}, ${a.region ?? ""} ${a.postalCode ?? ""}`;
}

// Checkout for a real order: choose or enter a shipping address (saved on the order), then review.
// The review also takes payment with one of the buyer's saved cards (or a new one, web only).
export function OrderCheckout({ id }: { id?: string }) {
  const app = useApp();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<0 | 1>(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [card, setCard] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const order = await getMyOrder(id ?? "");
        const [sale, saved, cards] = await Promise.all([getSale(order.saleId), listAddresses(), listCards()]);
        const product = await getProduct(sale.productId);
        if (!alive) return;
        setLoaded({ order, title: product.title, saved, cards });
        setCard(cards[0]?.id ?? null);
        setPaid(order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED");
        setStep(hasAddress(order) ? 1 : 0);
        setChosen((saved.find((a) => a.isDefault) ?? saved[0])?.id ?? null);
        setNewAddress(saved.length === 0);
      } catch (err) {
        if (alive) setError(describeApiError(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) {
    return (
      <Screen title="Checkout" onBack={app.back}>
        <EmptyState title="Couldn't open checkout" detail={error} />
      </Screen>
    );
  }
  if (!loaded) {
    return (
      <Screen title="Checkout" onBack={app.back}>
        <AppText muted>Loading…</AppText>
      </Screen>
    );
  }

  const { order, title, saved } = loaded;
  const editable = order.status === "PENDING_PAYMENT" || order.status === "PAID";

  const pay = async () => {
    if (!card) return;
    setPaying(true);
    setPayError("");
    try {
      const result = await payOrder(order.id, card, newIdempotencyKey());
      if (result.status === "SUCCEEDED") {
        setLoaded({ ...loaded, order: await getMyOrder(order.id) });
        setPaid(true);
      } else if (result.status === "FAILED") {
        setPayError(result.failureMessage ?? "Your card was declined. Try another card.");
      } else {
        setPayError("This card needs extra verification, which the app can't do yet. Try a different card.");
      }
    } catch (err) {
      // The answer may have been lost on the way back: check what the server says before blaming the card.
      try {
        const fresh = await getMyOrder(order.id);
        if (fresh.status === "PAID") {
          setLoaded({ ...loaded, order: fresh });
          setPaid(true);
          return;
        }
      } catch {
        // fall through to the original error
      }
      setPayError(describeApiError(err));
    } finally {
      setPaying(false);
    }
  };

  const refreshCards = async () => {
    const before = new Set(loaded.cards.map((c) => c.id));
    const cards = await listCards();
    setLoaded({ ...loaded, cards });
    setCard(cards.find((c) => !before.has(c.id))?.id ?? cards[0]?.id ?? null);
    setAddingCard(false);
  };

  const apply = async (fields: AddressFields) => {
    const updated = await setOrderAddress(order.id, fields);
    setLoaded({ ...loaded, order: updated });
    setStep(1);
  };

  if (!editable) {
    return (
      <Screen title="Checkout" onBack={app.back}>
        <EmptyState title="This order can no longer be changed" detail="The shipping address can only be set before the order ships." />
      </Screen>
    );
  }

  if (step === 0) {
    return (
      <Screen title="Shipping address" onBack={hasAddress(order) ? () => setStep(1) : app.back}>
        <AppText muted>{title}</AppText>
        {saved.length > 0 && !newAddress ? (
          <>
            <View accessibilityRole="radiogroup" style={{ gap: spacing.md }}>
              {saved.map((address) => (
                <Pressable
                  key={address.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: chosen === address.id }}
                  onPress={() => setChosen(address.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    padding: spacing.lg,
                    borderWidth: 1,
                    borderColor: chosen === address.id ? colors.brand : colors.line,
                    borderRadius: 12,
                    backgroundColor: chosen === address.id ? colors.brandSoft : colors.canvas,
                  }}
                >
                  <Icon
                    name={chosen === address.id ? "radio-button-on" : "radio-button-off"}
                    color={chosen === address.id ? colors.brand : colors.textSecondary}
                    size={22}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText bold size={14}>
                      {address.fullName}
                      {address.isDefault ? " · Default" : ""}
                    </AppText>
                    <AppText muted size={13}>
                      {formatAddress(address)}
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </View>
            {saveError ? <AppText style={{ color: colors.live }}>{saveError}</AppText> : null}
            <Button
              label="Ship to this address"
              loading={busy}
              disabled={!chosen}
              onPress={async () => {
                const address = saved.find((a) => a.id === chosen);
                if (!address) return;
                setBusy(true);
                setSaveError("");
                try {
                  await apply(address);
                } catch (err) {
                  setSaveError(describeApiError(err));
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Button secondary label="Use a different address" onPress={() => setNewAddress(true)} />
          </>
        ) : (
          <>
            <AddressForm
              submitLabel="Ship to this address"
              defaultToggleLabel="Save to my addresses"
              defaultToggleValue
              onSubmit={async (fields, saveIt) => {
                await apply(fields);
                if (saveIt) {
                  // The order already has its copy; a failure to save the book entry must not undo it.
                  try {
                    const created = await createAddress({ ...fields, isDefault: false });
                    setLoaded((prev) => (prev ? { ...prev, saved: [...prev.saved, created] } : prev));
                  } catch (err) {
                    app.toast(describeApiError(err));
                  }
                }
              }}
              {...(saved.length > 0 ? { onCancel: () => setNewAddress(false) } : {})}
            />
          </>
        )}
      </Screen>
    );
  }

  return (
    <Screen title="Review" onBack={app.back}>
      <AppText size={22} bold>
        {title}
      </AppText>

      <Section title="Ship to" />
      <AppText>{orderAddressText(order)}</AppText>
      <Button
        secondary
        label="Change shipping address"
        onPress={() => {
          setChosen((saved.find((a) => a.isDefault) ?? saved[0])?.id ?? null);
          setNewAddress(saved.length === 0);
          setStep(0);
        }}
      />

      <Section title="Order summary" />
      <AppText>Item {dollars(order.itemAmount)}</AppText>
      <AppText>Shipping {dollars(order.shippingAmount)}</AppText>
      <AppText>Tax {dollars(order.taxAmount)}</AppText>
      <AppText bold>Total {dollars(order.totalAmount)}</AppText>

      {paid ? (
        <>
          <Section title="Paid" />
          <AppText>Your payment went through. The seller can now ship your order.</AppText>
          <Button label="View order" onPress={app.back} />
        </>
      ) : order.status === "PENDING_PAYMENT" ? (
        <>
          <Section title="Pay with" />
          {loaded.cards.length > 0 && !addingCard ? (
            <>
              <View accessibilityRole="radiogroup" style={{ gap: spacing.md }}>
                {loaded.cards.map((c) => (
                  <Pressable
                    key={c.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: card === c.id }}
                    onPress={() => setCard(c.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      padding: spacing.lg,
                      borderWidth: 1,
                      borderColor: card === c.id ? colors.brand : colors.line,
                      borderRadius: 12,
                      backgroundColor: card === c.id ? colors.brandSoft : colors.canvas,
                    }}
                  >
                    <Icon
                      name={card === c.id ? "radio-button-on" : "radio-button-off"}
                      color={card === c.id ? colors.brand : colors.textSecondary}
                      size={22}
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                      <AppText bold size={14}>
                        {cardLabel(c)}
                      </AppText>
                      <AppText muted size={13}>
                        {cardExpiry(c)}
                      </AppText>
                    </View>
                  </Pressable>
                ))}
              </View>
              {payError ? <AppText style={{ color: colors.live }}>{payError}</AppText> : null}
              <Button label={`Pay ${dollars(order.totalAmount)}`} loading={paying} disabled={!card} onPress={pay} />
              <Button secondary label="Use a different card" onPress={() => setAddingCard(true)} />
            </>
          ) : (
            <>
              {loaded.cards.length === 0 ? <AppText muted>Add a card to pay for this order.</AppText> : null}
              <CardEntry
                submitLabel="Save card"
                onAdded={refreshCards}
                {...(loaded.cards.length > 0 ? { onCancel: () => setAddingCard(false) } : {})}
              />
            </>
          )}
        </>
      ) : (
        <Button label="Back to order" onPress={app.back} />
      )}
    </Screen>
  );
}
