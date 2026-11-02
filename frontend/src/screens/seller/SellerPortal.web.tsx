import React, { useState, useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppText, Icon, s } from '../../components';
import { buyer } from '../../data';
import { useApp } from '../../context';
import { ROUTES } from '../../constants/routes';
import { colors as c, formatUSD, radii, spacing } from '../../theme';
import { getBalance, type SellerBalance } from '../../api/seller-finance';
import { listLiveStreams, type StreamSession } from '../../api/streams';
import { InventoryContent } from './InventoryMobile';
import { SellerOrdersContent } from './SellerOrdersMobile';
import { SellerOffersContent } from './SellerOffersMobile';
import { ControlRoom } from './ControlRoom';
import { CreateShowContent } from './CreateShow';
import { PayoutsContent } from '../personal/PayoutsScreen';
import { SellerBankAccountContent } from './SellerBankAccountMobile';
import { SellerProfileEditContent } from './SellerProfileEditMobile';
import { ReviewsContent } from '../personal/ReviewsScreen';
import { TeamContent } from './TeamContent';
import { ModerationContent } from './ModerationContent';
import { SellerAction } from './SellHubMobile';
import type { IconName } from '../../components';

// Web desktop only (imported solely from `SellHub.web.tsx`). The seller portal, YouTube-Studio
// style — founder voice memo, 18 Oct 2026: clicking Sell must LAND on the portal with the
// dashboard as the first pane; a left rail of text items carries the navigation ("go live
// shouldn't be this giant-ass button"), and the section on the right swaps on the fly — one
// screen, no page-within-a-page route hops. Phone-width web still renders the app's mobile
// Sell tab (`SellHubMobile`), per the standing platform-sync rule.
//
// Every rail item is now an in-portal pane (E3d): content is pulled from the existing screens'
// Screen-free `…Content` bodies, so the standalone app screens and these panes render the same
// real components. Go live hosts `ControlRoom` bare per the founder-and-user decision — the
// broadcast flows run inside the portal pane instead of taking over the screen. The old
// full-screen routes keep working as deep links (ROUTES.CONTROL etc.) for inbound links; the
// portal simply never jumps out of itself anymore.

type PaneKey =
  | 'dashboard'
  | 'live'
  | 'schedule'
  | 'inventory'
  | 'orders'
  | 'offers'
  | 'payouts'
  | 'bank'
  | 'profile'
  | 'reviews'
  | 'team'
  | 'moderation';

const RAIL: { key: PaneKey; label: string; icon: IconName }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'stats-chart-outline' },
  { key: 'live', label: 'Go live', icon: 'radio-outline' },
  { key: 'schedule', label: 'Schedule show', icon: 'calendar-outline' },
  { key: 'inventory', label: 'Inventory', icon: 'grid-outline' },
  { key: 'orders', label: 'Orders', icon: 'receipt-outline' },
  { key: 'offers', label: 'Offers', icon: 'pricetag-outline' },
  { key: 'payouts', label: 'Payouts', icon: 'cash-outline' },
  { key: 'bank', label: 'Bank account', icon: 'card-outline' },
  { key: 'profile', label: 'Seller profile', icon: 'person-outline' },
  { key: 'reviews', label: 'Reviews', icon: 'star-outline' },
  { key: 'team', label: 'Team', icon: 'people-outline' },
  { key: 'moderation', label: 'Moderation', icon: 'shield-outline' },
];

// "Create listing" isn't a rail pane — it's the full Listing form (a route with its own id-param
// navigation), so it stays a jump to the existing screen, like the Dashboard's button.
export function SellerPortal() {
  const app = useApp();
  const [pane, setPane] = useState<PaneKey>('dashboard');
  const [balance, setBalance] = useState<SellerBalance | null>(null);
  const [liveSession, setLiveSession] = useState<StreamSession | null>(null);

  useEffect(() => {
    if (pane !== 'dashboard') return;
    getBalance()
      .then(setBalance)
      .catch(() => undefined);
  }, [pane]);

  useEffect(() => {
    // Fetch the current live session for moderation pane
    listLiveStreams()
      .then((res) => {
        const live = res.items.find((s) => s.status === 'LIVE');
        setLiveSession(live ?? null);
      })
      .catch(() => setLiveSession(null));
  }, []);

  const active = RAIL.find((item) => item.key === pane);

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {/* Left rail — the portal's navigation. Text items, YouTube-Studio style, per the founder's
          spec; active item gets the soft-tinted pill so the current pane reads at a glance. */}
      <View
        style={{
          width: 230,
          borderRightWidth: 1,
          borderColor: c.line,
          padding: spacing.lg,
          gap: 2,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
        <AppText bold size={18}>Seller portal</AppText>
        </View>
        {RAIL.map((item) => {
          const selected = item.key === pane;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setPane(item.key)}
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: 10,
                  paddingHorizontal: spacing.md,
                  borderRadius: radii.button,
                },
                selected && { backgroundColor: c.softCanvas },
              ]}
            >
              <Icon name={item.icon} size={18} color={selected ? c.brand : c.textSecondary} />
              <AppText
                size={14}
                bold={selected}
                style={{ color: selected ? c.text : c.textSecondary }}
              >
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* Right pane — swaps on the fly, keyed so scrolling resets between panes. Content bodies are
          the screens' Screen-free `…Content` components (E3c/E3d); titles come from the rail label. */}
      <ScrollView
        key={pane}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <AppText size={28} bold>
          {active ? active.label : 'Dashboard'}
        </AppText>
        {pane === 'dashboard' ? (
          <DashboardPane app={app} goPane={setPane} balance={balance} />
        ) : pane === 'live' ? (
          <ControlRoom bare />
        ) : pane === 'schedule' ? (
          <CreateShowContent onDone={() => setPane('dashboard')} />
        ) : pane === 'inventory' ? (
          <InventoryContent />
        ) : pane === 'orders' ? (
          <SellerOrdersContent />
        ) : pane === 'offers' ? (
          <SellerOffersContent />
        ) : pane === 'payouts' ? (
          <PayoutsContent />
        ) : pane === 'bank' ? (
          <SellerBankAccountContent />
        ) : pane === 'profile' ? (
          <SellerProfileEditContent />
        ) : pane === 'reviews' ? (
          <ReviewsContent />
        ) : pane === 'team' ? (
          <TeamContent />
        ) : (
          <ModerationContent sessionId={liveSession?.id ?? ''} />
        )}
      </ScrollView>
    </View>
  );
}

// The portal's dashboard: icon + label action row (founder feedback 24 Oct 2026: "should just be
// icons and text not buttons" — same `SellerAction` tile `SellHubMobile` uses, not a web-only
// pattern), balance card, and a hint. Everything else lives in its pane on the left. Stats stay OUT
// until a real seller-analytics endpoint exists — the old mock numbers were flagged inline; not
// re-shown here quietly.
function DashboardPane({
  app,
  goPane,
  balance,
}: {
  app: ReturnType<typeof useApp>;
  goPane: (pane: PaneKey) => void;
  balance: SellerBalance | null;
}) {
  return (
    <>
      <AppText muted size={13}>
        Everything about your store, in one place. Pick a section on the left.
      </AppText>
      <View
        style={[s.row, { marginTop: spacing.sm, justifyContent: 'space-around', maxWidth: 420 }]}
      >
        <SellerAction icon="radio-outline" label="Go live" onPress={() => goPane('live')} />
        <SellerAction
          icon="calendar-outline"
          label="Schedule show"
          onPress={() => goPane('schedule')}
        />
        <SellerAction
          icon="pricetag-outline"
          label="Create listing"
          onPress={() => app.navigate(ROUTES.LISTING)}
        />
      </View>
      <Pressable onPress={() => goPane('payouts')} style={{ marginTop: spacing.md }}>
        <AppText muted size={12}>
          Available balance
        </AppText>
        <AppText size={30} bold style={{ marginTop: spacing.md }}>
          {balance ? formatUSD(balance.availableAmount / 100) : 'N/A'}
        </AppText>
      </Pressable>
    </>
  );
}
