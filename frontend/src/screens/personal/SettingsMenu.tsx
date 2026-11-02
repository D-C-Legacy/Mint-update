import React from 'react';
import { Pressable, View } from 'react-native';
import { AppText, MenuRow, s } from '../../components';
import { ROUTES } from '../../constants';
import { colors as c, spacing } from '../../theme';
import { useApp, useAuth } from '../../hooks';

// The settings menu, shared by the mobile hub screen and the desktop settings master-detail's left
// column. Also the single destination for the profile icon/tab (founder feedback 24 Oct 2026: the
// old separate "Your corner" page and this page both led here via a gear icon, so it's gone).
// Grouped into the founder's 5 named buckets (24 Oct 2026) instead of one flat list — the items that
// didn't fit any of the 5 (Saved/Following/Recently viewed, Bids & Offers) were folded into the
// closest one's own hub (`AccountScreen`'s "Your Activity", `PurchaseHistoryScreen`) rather than
// dropped.
export function SettingsMenu() {
  const app = useApp(),
    auth = useAuth();
  const items = [
    ['Account', ROUTES.ACCOUNT],
    ['Payment Methods', ROUTES.PAYMENTS],
    ['Purchase History', ROUTES.PURCHASE_HISTORY],
    ['Preferences', ROUTES.PREFERENCES],
    ['Help & Support', ROUTES.HELP],
  ] as const;
  return (
    <>
      {items.map(([title, route]) => (
        <MenuRow key={route} title={title} onPress={() => app.navigate(route)} />
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log out"
        onPress={auth.logout}
        style={({ pressed }) => [
          s.row,
          {
            paddingVertical: 17,
            borderBottomWidth: 1,
            borderColor: c.line,
            gap: spacing.md,
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <AppText bold style={{ color: c.live }}>
            Log out
          </AppText>
        </View>
      </Pressable>
    </>
  );
}
