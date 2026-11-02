import React, { useState } from "react";
import { View } from "react-native";
import { AppText, Button, EmptyState, Screen } from "../../components";
import { CardEntry } from "../../components/commerce/CardEntry";
import { useApp } from "../../hooks";
import { useAsync } from "../../api/use-async";
import { describeApiError } from "../../api/describe-error";
import { cardExpiry, cardLabel, deleteCard, listCards } from "../../api/payments";
import { colors, spacing } from "../../theme";

// Saved cards (GET/DELETE /v1/payments/methods). Cards are stored by Stripe, not by us; this screen
// only shows brand, last four and expiry. Adding a card uses Stripe's own form (web only for now).
export function PaymentsScreen() {
  const app = useApp();
  const { state, reload } = useAsync(listCards, []);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (adding) {
    return (
      <Screen title="Add a card" onBack={() => setAdding(false)}>
        <CardEntry
          onAdded={() => {
            app.toast("Card saved");
            reload();
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      </Screen>
    );
  }

  return (
    <Screen title="Payment methods" onBack={app.back}>
      {state.status === "loading" ? <AppText muted>Loading…</AppText> : null}
      {state.status === "error" ? (
        <>
          <EmptyState title="Couldn't load your cards" detail={state.message} />
          <Button secondary label="Try again" onPress={reload} />
        </>
      ) : null}
      {state.status === "ready" && state.data.length === 0 ? (
        <AppText muted>You haven't saved a card yet.</AppText>
      ) : null}
      {state.status === "ready"
        ? state.data.map((card) => (
            <View
              key={card.id}
              style={{
                gap: spacing.sm,
                marginBottom: spacing.md,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 12,
              }}
            >
              <AppText bold>{cardLabel(card)}</AppText>
              <AppText muted>{cardExpiry(card)}</AppText>
              {confirmDelete === card.id ? (
                <>
                  <AppText>Remove this card?</AppText>
                  <Button
                    variant="danger"
                    label="Remove"
                    loading={busyId === card.id}
                    onPress={async () => {
                      setBusyId(card.id);
                      try {
                        await deleteCard(card.id);
                        app.toast("Card removed");
                        reload();
                      } catch (err) {
                        app.toast(describeApiError(err));
                      } finally {
                        setBusyId(null);
                        setConfirmDelete(null);
                      }
                    }}
                  />
                  <Button secondary label="Keep it" onPress={() => setConfirmDelete(null)} />
                </>
              ) : (
                <Button variant="ghost" label="Remove card" onPress={() => setConfirmDelete(card.id)} />
              )}
            </View>
          ))
        : null}
      {state.status === "ready" ? <Button label="Add card" onPress={() => setAdding(true)} /> : null}
    </Screen>
  );
}
