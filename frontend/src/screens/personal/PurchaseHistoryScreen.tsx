import React from 'react';
import { MenuRow, Screen } from '../../components';
import { ROUTES } from '../../constants';
import { useApp } from '../../hooks';

// Settings restructure (founder feedback 24 Oct 2026): "Purchase History" bucket's own hub —
// Bids & Offers folded in here alongside Purchases since it didn't fit any of the 5 new buckets.
export function PurchaseHistoryScreen({ inline = false }: { inline?: boolean }) {
  const app = useApp();
  return (
    <Screen title="Purchase History" onBack={inline ? undefined : app.back}>
      <MenuRow title="Purchases" onPress={() => app.navigate(ROUTES.ORDERS)} />
      <MenuRow title="Bids & Offers" onPress={() => app.navigate(ROUTES.BIDS)} />
    </Screen>
  );
}
