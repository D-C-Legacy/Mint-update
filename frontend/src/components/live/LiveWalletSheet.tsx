import React from 'react';
import { View } from 'react-native';
import { AppText, Button, EmptyState } from '../ui';
import { useAsync } from '../../api/use-async';
import { cardExpiry, cardLabel, listCards } from '../../api/payments';
import { spacing } from '../../theme';

// Shown inside the live viewer's Wallet sheet (LiveReel.tsx / LiveReelDesktop.tsx) instead of
// navigating away from the stream — founder feedback (26 Oct 2026): Wallet was the one action-rail
// button that broke out to a whole new page while Share/Shop both stayed in place. A quick glance
// at saved cards, plus an escape hatch to the full Payment Methods settings screen for anything
// more (adding/removing a card) — same "View full product" pattern the product sheet already uses.
export function LiveWalletSheetContent({ onManage }: { onManage: () => void }) {
  const { state } = useAsync(listCards, []);

  return (
    <View style={{ gap: spacing.md }}>
      {state.status === 'loading' ? <AppText muted>Loading…</AppText> : null}
      {state.status === 'error' ? (
        <EmptyState title="Couldn't load your cards" detail={state.message} />
      ) : null}
      {state.status === 'ready' && state.data.length === 0 ? (
        <AppText muted>You haven't saved a card yet.</AppText>
      ) : null}
      {state.status === 'ready'
        ? state.data.map((card) => (
            <View key={card.id} style={{ gap: 2 }}>
              <AppText bold>{cardLabel(card)}</AppText>
              <AppText muted size={12}>
                Expires {cardExpiry(card)}
              </AppText>
            </View>
          ))
        : null}
      <Button secondary label="Manage payment methods" onPress={onManage} />
    </View>
  );
}
