import React, { createElement, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AppText, Button, Field } from "../ui";
import { createSetupIntent } from "../../api/payments";
import { describeApiError } from "../../api/describe-error";
import { colors, spacing } from "../../theme";

// The slice of Stripe.js this file uses. Stripe.js is loaded from js.stripe.com at run time (no npm
// package): the card number is typed into Stripe's own iframe and goes from the browser to Stripe,
// so it never touches this app's code or our server (which keeps us out of card-data scope).
type StripeElement = { mount: (el: HTMLElement) => void; destroy: () => void };
type StripeJs = {
  elements: () => { create: (type: "card", options: object) => StripeElement };
  confirmCardSetup: (
    clientSecret: string,
    data: { payment_method: { card: StripeElement; billing_details?: { name?: string } } },
  ) => Promise<{ error?: { message?: string } }>;
};
type StripeGlobal = (publishableKey: string) => StripeJs;

let loading: Promise<StripeGlobal> | null = null;
function loadStripeJs(): Promise<StripeGlobal> {
  const existing = (window as unknown as { Stripe?: StripeGlobal }).Stripe;
  if (existing) return Promise.resolve(existing);
  if (!loading) {
    loading = new Promise<StripeGlobal>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.async = true;
      script.onload = () => {
        const loaded = (window as unknown as { Stripe?: StripeGlobal }).Stripe;
        if (loaded) resolve(loaded);
        else reject(new Error("Stripe did not load"));
      };
      script.onerror = () => reject(new Error("Stripe could not be reached"));
      document.head.appendChild(script);
    }).catch((err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

type Ready = { stripe: StripeJs; card: StripeElement; clientSecret: string };

// Adds a card to the signed-in user's saved cards: asks our server for a setup intent, shows
// Stripe's card form, and confirms the card with Stripe. On success the card is saved to the user's
// Stripe customer and `onAdded` runs.
export function CardEntry({
  onAdded,
  onCancel,
  submitLabel = "Save card",
}: {
  onAdded: () => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const mountRef = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState<Ready | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    let element: StripeElement | null = null;
    (async () => {
      try {
        const [setup, StripeCtor] = await Promise.all([createSetupIntent(), loadStripeJs()]);
        if (!alive || !mountRef.current) return;
        const stripe = StripeCtor(setup.publishableKey);
        element = stripe.elements().create("card", {
          hidePostalCode: true,
          style: { base: { fontSize: "16px", color: colors.text } },
        });
        element.mount(mountRef.current);
        setReady({ stripe, card: element, clientSecret: setup.clientSecret });
      } catch (err) {
        if (alive) setError(err instanceof Error && err.message.startsWith("Stripe") ? "Couldn't reach Stripe. Check your connection and try again." : describeApiError(err));
      }
    })();
    return () => {
      alive = false;
      element?.destroy();
    };
  }, []);

  const save = async () => {
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      const result = await ready.stripe.confirmCardSetup(ready.clientSecret, {
        payment_method: { card: ready.card, ...(name.trim() ? { billing_details: { name: name.trim() } } : {}) },
      });
      if (result.error) {
        setError(result.error.message ?? "That card could not be saved.");
        return;
      }
      onAdded();
    } catch {
      setError("Couldn't reach Stripe. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Field label="Name on card (optional)" value={name} onChange={setName} maxLength={100} />
      <AppText bold size={13}>
        Card details
      </AppText>
      {createElement("div", {
        ref: mountRef,
        style: {
          padding: 14,
          border: `1px solid ${colors.line}`,
          borderRadius: 12,
          background: colors.softCanvas,
          minHeight: 20,
        },
      })}
      <AppText muted size={12}>
        Card details go straight to Stripe. This app never sees your card number.
      </AppText>
      {error ? <AppText style={{ color: colors.live }}>{error}</AppText> : null}
      <Button label={submitLabel} loading={busy} disabled={!ready} onPress={save} />
      {onCancel ? <Button secondary label="Cancel" onPress={onCancel} /> : null}
    </View>
  );
}
