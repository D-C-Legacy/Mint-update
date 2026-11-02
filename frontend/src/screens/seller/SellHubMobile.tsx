import * as tokens from '../../theme';
import { ROUTES } from '../../constants/routes';
import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import {
  AppText,
  Badge,
  IconMark,
  MenuRow,
  Screen,
  Section,
  s,
  type IconName,
} from '../../components';
import { colors as c } from '../../theme';
import { formatUSD } from '../../theme';
import { useApp } from '../../context';
import { useSellerGate } from '../../hooks/useSellerGate';
import { getBalance, type SellerBalance } from '../../api/seller-finance';
import { listMyProducts, type SellerProduct } from '../../api/seller-products';
import { SellerApply } from './SellerApply';

// The app's own Sell tab. Single source of truth for that layout: the native entry point
// (`SellHub.tsx`) re-exports it unchanged, and the web entry point (`SellHub.web.tsx`) renders it
// too at phone-width viewports, same pattern as the rest of this arc. Only `SellHub.web.tsx` has a
// second, desktop-only two-column layout — gated on the same `useSellerGate` hook either way.
export function SellHubMobile() {
  const { seller, reload } = useSellerGate();
  if (seller === 'loading') {
    return null;
  }
  if (!seller || seller.status !== 'APPROVED') {
    return <SellerApply onApproved={reload} />;
  }
  return <ApprovedSellHubMobile />;
}

export function ApprovedSellHubMobile() {
  const app = useApp();
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [balance, setBalance] = useState<SellerBalance | null>(null);

  useEffect(() => {
    listMyProducts({ limit: 2 })
      .then((page) => setProducts(page.items))
      .catch(() => undefined);
    getBalance()
      .then(setBalance)
      .catch(() => undefined);
  }, []);

  return (
    // No avatar in the header (dropped 28 Oct 2026, founder feedback: it showed here on mobile web
    // and the app, but not on the desktop seller portal's own header — same place, two different
    // treatments. Profile is reached from the Profile tab, not duplicated here.)
    <Screen title="Your studio">
      <Section title="Ready for your next show?" />
      <AppText muted>Share what you love. Build your community.</AppText>
      {/* "Go live" and "Schedule show" stay a simulated preview: creating a real Sale needs a
          live stream session, which is blocked on streaming (no video provider chosen, D-005).
          Founder feedback (24 Oct 2026): these read as "unnecessary giant buttons" — icon + label
          instead of filled button blocks, same treatment as `IconMark` already uses for hero icons
          elsewhere, not a new pattern invented just for this screen. */}
      <View style={[s.row, { marginVertical: tokens.spacing.xxl, justifyContent: 'space-around' }]}>
        <SellerAction
          icon="radio-outline"
          label="Go live"
          onPress={() => app.navigate(ROUTES.CONTROL)}
        />
        <SellerAction
          icon="calendar-outline"
          label="Schedule show"
          onPress={() => app.navigate(ROUTES.CREATE_SHOW)}
        />
        <SellerAction
          icon="pricetag-outline"
          label="Create listing"
          onPress={() => app.navigate(ROUTES.LISTING)}
        />
      </View>
      <Pressable
        onPress={() => app.navigate(ROUTES.PAYOUTS)}
        style={{ marginTop: tokens.spacing.xxl }}
      >
        <AppText muted size={12}>
          Available balance
        </AppText>
        <AppText size={30} bold style={{ marginTop: tokens.spacing.md }}>
          {balance ? formatUSD(balance.availableAmount / 100) : 'N/A'}
        </AppText>
      </Pressable>
      <Section
        title="Your inventory"
        action="Manage"
        onPress={() => app.navigate(ROUTES.INVENTORY)}
      />
      {products.length === 0 ? (
        <AppText muted>No listings yet.</AppText>
      ) : (
        products.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => app.navigate(ROUTES.LISTING, p.id)}
            style={[
              s.row,
              { gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderColor: c.line },
            ]}
          >
            <View style={{ flex: 1 }}>
              <AppText bold size={14}>
                {p.title}
              </AppText>
              <AppText muted size={12}>
                Qty {p.quantity}
              </AppText>
            </View>
            <Badge label={p.status} />
          </Pressable>
        ))
      )}
      <MenuRow
        title="Offers"
        detail="Accept, reject, or counter buyer offers"
        onPress={() => app.navigate(ROUTES.OFFERS)}
      />
      <MenuRow
        title="Orders"
        detail="Ship and track buyer orders"
        onPress={() => app.navigate(ROUTES.SELLER_ORDERS)}
      />
      <MenuRow
        title="Seller dashboard"
        detail="Payouts, profile, and the bigger picture"
        onPress={() => app.navigate(ROUTES.DASHBOARD)}
      />
    </Screen>
  );
}

export function SellerAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [{ alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 }]}
    >
      <IconMark name={icon} size={60} />
      <AppText size={12} bold style={{ color: c.text, textAlign: 'center' }}>
        {label}
      </AppText>
    </Pressable>
  );
}
