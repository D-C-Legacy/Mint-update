import * as tokens from "../../theme";
import { PriceDisplay } from "../../components/commerce/PriceDisplay";
import { Card } from "../../components/ui/Card";
import { useAuth } from "../../hooks";
import { ROUTES } from "../../constants/routes";
import React, { useState } from "react";
import { View, Switch, Pressable } from "react-native";
import {
  AppText,
  Button,
  Chips,
  EmptyState,
  Field,
  Icon,
  Photo,
  Screen,
  Section,
  s,
} from "../../components";
import { orders, products } from "../../data";
import { colors as c, formatUSD } from "../../theme";
import { useApp } from "../../context";
// This old mock checkout only serves the mock live-stream entry points; real orders use
// OrderCheckout. Its cards are a fixed fake list, not the user's saved cards.
const MOCK_CARDS = ["Visa ···· 4242", "Mastercard ···· 4444"];
export function Checkout({ id, amount }: { id?: string; amount?: number }) {
  const app = useApp();
  const auth = useAuth();
  const product = app.inventory.find((x) => x.id === id) || products[0]!;
  const [express, setExpress] = useState(false);
  const shipping = (product.shipping ?? 12) * (express ? 2 : 1);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(auth.user?.name ?? "");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");
  const [apartment, setApartment] = useState("");
  const [payment, setPayment] = useState(MOCK_CARDS[0] ?? "");
  const [failure, setFailure] = useState(false);
  const steps = [
    "Shipping address",
    "Payment method",
    "Order review",
    "All yours",
  ];
  return (
    <Screen
      title={steps[step]!}
      onBack={step > 0 && step < 3 ? () => setStep((v) => v - 1) : app.back}
    >
      {step < 3 && (
        <View style={{ gap: 20, marginBottom: 20 }}>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            {["Shipping", "Payment", "Review"].map((label, index) => (
              <View
                key={label}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: index <= step ? c.brand : c.line,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AppText white size={12}>
                    {index < step ? "✓" : index + 1}
                  </AppText>
                </View>
                <AppText
                  size={12}
                  style={{ color: index === step ? c.brand : c.textSecondary }}
                >
                  {label}
                </AppText>
              </View>
            ))}
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: 12,
            }}
          >
            <Photo
              uri={product.image}
              style={{ width: 56, height: 56, borderRadius: 8 }}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText bold size={14}>
                {product.name}
              </AppText>
              <AppText muted size={12}>
                {product.variant} · {product.condition}
              </AppText>
            </View>
            <PriceDisplay bold size={14} value={amount ?? product.price} />
          </View>
        </View>
      )}
      {step === 0 ? (
        <View>
          <Field label="Full name" value={name} onChange={setName} />
          <Field label="Street address" value={address} onChange={setAddress} />
          <Field
            label="Apartment / suite (optional)"
            value={apartment}
            onChange={setApartment}
            placeholder="e.g. Apt 4B"
          />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 2 }}>
              <Field label="City" value={city} onChange={setCity} />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="State"
                value={region}
                onChange={setRegion}
                autoCapitalize="characters"
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="ZIP code"
                value={postal}
                onChange={setPostal}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Country"
                value="United States"
                onChange={() => {}}
                disabled
              />
            </View>
          </View>
          <Section title="Delivery method" />
          <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
            {[false, true].map((option) => (
              <Pressable
                key={String(option)}
                accessibilityRole="radio"
                accessibilityState={{ checked: express === option }}
                onPress={() => setExpress(option)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: express === option ? c.brand : c.line,
                  borderRadius: 12,
                  backgroundColor: express === option ? c.brandSoft : c.canvas,
                }}
              >
                <Icon
                  name={
                    express === option ? "radio-button-on" : "radio-button-off"
                  }
                  color={express === option ? c.brand : c.textSecondary}
                  size={22}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText bold size={14}>
                    {option ? "Express shipping" : "Standard shipping"}
                  </AppText>
                  <AppText muted size={12}>
                    {formatUSD((product.shipping ?? 12) * (option ? 2 : 1))} ·{" "}
                    {option ? "1–2" : "3–5"} business days
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : step === 1 ? (
        <>
          <Section title="Choose a demo card" />
          <Chips
            items={MOCK_CARDS}
            value={payment}
            onChange={setPayment}
          />
          <AppText muted>No card details are collected or charged.</AppText>
          <View style={[s.row, { marginVertical: tokens.spacing.xxl }]}>
            <AppText>Simulate payment failure</AppText>
            <Switch
              value={failure}
              onValueChange={setFailure}
              trackColor={{ true: c.brand }}
            />
          </View>
        </>
      ) : step === 2 ? (
        <View style={{ gap: tokens.spacing.lg, marginTop: tokens.spacing.xxl }}>
          {[
            {
              title: "Ship to",
              detail: `${name}\n${address}${apartment ? `, ${apartment}` : ""}\n${city}, ${region} ${postal}`,
              edit: 0,
            },
            { title: "Payment", detail: payment, edit: 1 },
            {
              title: "Delivery",
              detail: express
                ? "Express · 1–2 business days"
                : "Standard · 3–5 business days",
              edit: 0,
            },
          ].map((section) => (
            <View
              key={section.title}
              style={{
                gap: 10,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: c.line,
              }}
            >
              <View style={s.row}>
                <AppText bold>{section.title}</AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${section.title.toLowerCase()}`}
                  hitSlop={10}
                  onPress={() => setStep(section.edit)}
                >
                  <AppText size={13} style={{ color: c.brand }}>
                    Edit
                  </AppText>
                </Pressable>
              </View>
              <AppText size={14}>{section.detail}</AppText>
            </View>
          ))}
          <Section title="Order summary" />
          <Card style={[{ gap: tokens.spacing.md }]}>
            <View style={s.row}>
              <AppText>Item</AppText>
              <PriceDisplay value={amount ?? product.price} />
            </View>
            <View style={s.row}>
              <AppText>Shipping</AppText>
              <PriceDisplay value={shipping} />
            </View>
            <View style={s.row}>
              <AppText bold>Total</AppText>
              <PriceDisplay bold value={(amount ?? product.price) + shipping} />
            </View>
          </Card>
        </View>
      ) : (
        <EmptyState
          title="It’s all yours!"
          detail="Your mock purchase is confirmed. No payment was processed."
          onPress={() => app.navigate(ROUTES.ORDERS)}
          label="View orders"
        />
      )}
      {step < 3 && (
        <View style={{ marginTop: tokens.spacing.xxl, gap: tokens.spacing.md }}>
          <Button
            label={
              step === 2
                ? "Confirm mock purchase"
                : step === 0
                  ? "Continue to payment"
                  : "Continue to review"
            }
            disabled={
              (step === 0 &&
                [name, address, city, region, postal].some((v) => !v.trim())) ||
              (step === 1 && !payment)
            }
            onPress={() => {
              if (step === 2 && failure) {
                app.toast(
                  "Payment failed. Choose another demo method and try again.",
                );
                setStep(1);
                return;
              }
              if (step === 2)
                app.addOrder(product.id, amount ?? product.price, shipping);
              setStep((v) => v + 1);
            }}
          />
          {step === 2 && (
            <AppText muted size={12}>
              UI preview only · No real purchase
            </AppText>
          )}
        </View>
      )}
    </Screen>
  );
}
