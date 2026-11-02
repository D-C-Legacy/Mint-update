import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { CardField, StripeProvider, useStripe } from '@stripe/stripe-react-native';
import type { CardFieldInput } from '@stripe/stripe-react-native';
import { AppText, Button, Field } from '../ui';
import { createSetupIntent } from '../../api/payments';
import { describeApiError } from '../../api/describe-error';
import { colors, spacing } from '../../theme';

type Ready = { clientSecret: string; publishableKey: string };

// Adds a card to the signed-in user's saved cards: asks our server for a setup intent, shows
// Stripe's native card field, and confirms the setup intent with Stripe's native SDK. On success
// the card is saved to the user's Stripe customer and `onAdded` runs. Mirrors CardEntry.web.tsx's
// flow; see CardEntry.web.tsx for the Stripe.js equivalent used on web.
export function CardEntry({
  onAdded,
  onCancel,
  submitLabel = 'Save card',
}: {
  onAdded: () => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [ready, setReady] = useState<Ready | null>(null);
  const [card, setCard] = useState<CardFieldInput.Details | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const setup = await createSetupIntent();
        if (alive) setReady(setup);
      } catch (err) {
        if (alive) setError(describeApiError(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) {
    return error ? (
      <AppText style={{ color: colors.live }}>{error}</AppText>
    ) : (
      <AppText muted>Loading…</AppText>
    );
  }

  return (
    <StripeProvider publishableKey={ready.publishableKey}>
      <CardEntryForm
        ready={ready}
        card={card}
        setCard={setCard}
        name={name}
        setName={setName}
        error={error}
        setError={setError}
        busy={busy}
        setBusy={setBusy}
        onAdded={onAdded}
        onCancel={onCancel}
        submitLabel={submitLabel}
      />
    </StripeProvider>
  );
}

// Split out so useStripe() (which needs to run inside StripeProvider) isn't called before the
// provider mounts.
function CardEntryForm({
  ready,
  card,
  setCard,
  name,
  setName,
  error,
  setError,
  busy,
  setBusy,
  onAdded,
  onCancel,
  submitLabel,
}: {
  ready: Ready;
  card: CardFieldInput.Details | null;
  setCard: (c: CardFieldInput.Details) => void;
  name: string;
  setName: (v: string) => void;
  error: string;
  setError: (v: string) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onAdded: () => void | Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const { confirmSetupIntent } = useStripe();

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await confirmSetupIntent(ready.clientSecret, {
        paymentMethodType: 'Card',
        paymentMethodData: name.trim() ? { billingDetails: { name: name.trim() } } : undefined,
      });
      if (result.error) {
        setError(result.error.message || 'That card could not be saved.');
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
      <CardField
        postalCodeEnabled={false}
        onCardChange={setCard}
        style={{
          height: 50,
          backgroundColor: colors.softCanvas,
          borderRadius: 12,
        }}
        cardStyle={{
          backgroundColor: colors.softCanvas,
          textColor: colors.text,
          borderColor: colors.line,
          borderWidth: 1,
          borderRadius: 12,
        }}
      />
      <AppText muted size={12}>
        Card details go straight to Stripe. This app never sees your card number.
      </AppText>
      {error ? <AppText style={{ color: colors.live }}>{error}</AppText> : null}
      <Button label={submitLabel} loading={busy} disabled={!card?.complete} onPress={save} />
      {onCancel ? <Button secondary label="Cancel" onPress={onCancel} /> : null}
    </View>
  );
}
