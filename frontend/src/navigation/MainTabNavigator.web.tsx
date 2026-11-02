import * as tokens from '../theme';
import { RouteNavigator } from './RouteNavigator';
import { useMarketplaceState } from '../hooks/useMarketplaceState';
import { ROUTES, type RouteName } from '../constants/routes';
import { TABS } from '../constants/routes';
import { APP_NAME } from '../constants/app';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppContext } from '../context';
import { colors as c, spacing, radii } from '../theme';
import { AppText, IconButton, SearchBar } from '../components';
import { Live } from '../Live';
import { Discover } from '../Marketplace';
import { SellHub } from '../Seller';
import { Inbox, Settings } from '../Personal';
import { useNavigation } from '../hooks/useNavigation';
import { useNotifications } from '../hooks/useNotifications';
import { useMessaging } from '../hooks/useMessaging';
import { MainTabShell } from './MainTabShell';
import { listNotifications, type NotificationItem } from '../api/notifications';
import { describeApiError } from '../api/describe-error';
import { NotificationRow } from '../screens/personal/InboxRows';

// Web only. Below DESKTOP_BREAKPOINT this renders the exact same mobile shell the app uses
// (`MainTabShell`) — web on a phone-width browser must look like the app, not like a squeezed
// desktop layout. At/above it, this renders the desktop shell: a top navbar (Whatnot-style)
// instead of the bottom tab bar, full width instead of the phone frame. Screens themselves
// (Live, Discover, ...) aren't converted yet (that's Phases 2-4) — they render under the new
// navbar as-is for now, which is an expected transitional look, not a bug.
const DESKTOP_BREAKPOINT = 768;

export function MainTabNavigator() {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT) return <MainTabShell />;
  return <DesktopShell />;
}

function DesktopShell() {
  const { tab, setTab, routes, setRoutes, back, navigate, selectStream, stream } = useNavigation();
  const market = useMarketplaceState();
  const { unreadCount: unreadNotifications } = useNotifications();
  const { unreadCount: unreadMessages } = useMessaging();
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const route = routes[routes.length - 1];
  const dark = tab === ROUTES.LIVE && !route;
  // Screens with their own real desktop layout (Live's split view, Discover's grid, Product's
  // 2-column page, Sell's 2-column studio/inventory split) want the full 1280px width. Every other
  // screen (Profile, Inbox, settings, ...) is still the mobile-styled single-column screens, which
  // read better in a centered column than stretched edge-to-edge. Decided centrally, once, rather
  // than per-screen, so screens that haven't needed their own desktop layout yet don't have to.
  const wide =
    (tab === ROUTES.LIVE && !route) ||
    (tab === ROUTES.DISCOVER && !route) ||
    (tab === ROUTES.SELL && !route) ||
    (tab === ROUTES.PROFILE && !route) ||
    (tab === ROUTES.INBOX && !route) ||
    (route !== undefined &&
      (
        [
          ROUTES.PRODUCT,
          ROUTES.ORDERS,
          ROUTES.ORDER,
          ROUTES.BIDS,
          ROUTES.SETTINGS,
          ROUTES.ACCOUNT,
          ROUTES.PAYMENTS,
          ROUTES.PRIVACY,
          ROUTES.HELP,
          ROUTES.PAYOUTS,
          ROUTES.REVIEWS,
          ROUTES.NOTIFICATIONS,
          ROUTES.DASHBOARD,
          ROUTES.INVENTORY,
          ROUTES.SELLER_ORDERS,
          ROUTES.OFFERS,
          ROUTES.LISTING,
          ROUTES.SELLER_PROFILE_EDIT,
          ROUTES.SELLER_BANK_ACCOUNT,
          ROUTES.SELLER_APPLICATION,
          ROUTES.SELLER,
          ROUTES.SEARCH,
          ROUTES.CONVERSATION,
        ] as RouteName[]
      ).includes(route.name));

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  const context = { navigate, back, toast: setNotice, selectStream, ...market };

  function goTab(name: (typeof TABS)[number]['name']): void {
    setTab(name);
    setRoutes([]);
  }

  function renderRoute() {
    if (!route) {
      switch (tab) {
        case ROUTES.LIVE:
          return <Live streamId={stream} navVisible onNavVisibility={() => undefined} />;
        case ROUTES.DISCOVER:
          return <Discover />;
        case ROUTES.SELL:
          return <SellHub />;
        case ROUTES.INBOX:
          return <Inbox />;
        case ROUTES.PROFILE:
          // Founder feedback (24 Oct 2026): the old "Your corner" page and its gear icon both led
          // here anyway, so the profile icon now opens settings directly instead of a stop in
          // between.
          return <Settings name={ROUTES.SETTINGS} />;
      }
    }
    return <RouteNavigator route={route} />;
  }

  return (
    <AppContext.Provider value={context}>
      <View style={[styles.page, { backgroundColor: dark ? c.ink : c.canvas }]}>
        <StatusBar style="dark" />
        <View style={styles.navbar}>
          <View style={styles.navbarInner}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Home"
              onPress={() => goTab(ROUTES.LIVE)}
              style={styles.logo}
            >
              <AppText bold size={26} style={{ color: c.brand }}>
                {APP_NAME}
              </AppText>
            </Pressable>

            <View style={styles.navLinks}>
              <NavLink
                label="Home"
                active={tab === ROUTES.LIVE}
                onPress={() => goTab(ROUTES.LIVE)}
              />
              <NavLink
                label="Discover"
                active={tab === ROUTES.DISCOVER}
                onPress={() => goTab(ROUTES.DISCOVER)}
              />
            </View>

            <View style={styles.searchOuter}>
              <View style={styles.search}>
                <SearchBar
                  value={query}
                  onChange={setQuery}
                  onFocus={() => navigate(ROUTES.SEARCH)}
                />
              </View>
            </View>

            <View style={styles.navActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sell"
                onPress={() => goTab(ROUTES.SELL)}
                style={({ pressed }) => [styles.sellPill, { opacity: pressed ? 0.85 : 1 }]}
              >
                <AppText bold size={13} style={{ color: '#FFFFFF' }}>
                  Sell
                </AppText>
              </Pressable>
              <View>
                <IconButton
                  name="chatbubble-outline"
                  label="Inbox"
                  onPress={() => goTab(ROUTES.INBOX)}
                />
                {unreadMessages > 0 && <View style={styles.dot} />}
              </View>
              <NotificationsBell
                unreadCount={unreadNotifications}
                onViewAll={() => navigate(ROUTES.ACTIVITY)}
              />
              <IconButton
                name="person-outline"
                label="Profile"
                onPress={() => goTab(ROUTES.PROFILE)}
              />
            </View>
          </View>
        </View>

        <View style={styles.content} key={route ? route.name + routes.length : tab}>
          {wide ? renderRoute() : <View style={styles.contentNarrow}>{renderRoute()}</View>}
        </View>

        {notice !== '' && (
          <Pressable accessibilityRole="alert" onPress={() => setNotice('')} style={styles.toast}>
            <AppText white size={13}>
              {notice}
            </AppText>
          </Pressable>
        )}
      </View>
    </AppContext.Provider>
  );
}

// Founder feedback (24 Oct 2026): web needs its own notifications button next to the profile icon,
// not just the Inbox icon's shared dot — a dropdown of the same Activity feed the Inbox page's
// "Activity" column already shows, so this list stays lazy (only fetched once opened) instead of
// duplicating the Inbox page's own fetch on every page load.
function NotificationsBell({
  unreadCount,
  onViewAll,
}: {
  unreadCount: number;
  onViewAll: () => void;
}) {
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || status !== 'idle') return;
    setStatus('loading');
    listNotifications()
      .then((page) => {
        setItems(page.items);
        setStatus('ready');
      })
      .catch((err) => {
        setError(describeApiError(err));
        setStatus('error');
      });
  }, [open, status]);

  async function openItem(item: NotificationItem) {
    if (item.readAt === null) {
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      await notifications.markRead(item.id).catch(() => undefined);
    }
    setOpen(false);
  }

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await notifications.markAllRead().catch(() => undefined);
  }

  return (
    <View>
      <IconButton
        name="notifications-outline"
        label="Notifications"
        onPress={() => setOpen((o) => !o)}
      />
      {unreadCount > 0 && <View style={styles.dot} />}
      {open && (
        <>
          <Pressable
            accessibilityLabel="Close notifications"
            onPress={() => setOpen(false)}
            style={styles.bellOverlay}
          />
          <View style={styles.bellPanel}>
            <View style={styles.bellHeader}>
              <AppText bold size={16}>
                Notifications
              </AppText>
              <Pressable accessibilityRole="button" onPress={markAllRead}>
                <AppText size={13} style={{ color: c.brand }}>
                  Mark all read
                </AppText>
              </Pressable>
            </View>
            <ScrollView
              style={{ maxHeight: 320 }}
              contentContainerStyle={{ paddingHorizontal: spacing.lg }}
              showsVerticalScrollIndicator={false}
            >
              {status === 'loading' || status === 'idle' ? (
                <AppText muted style={{ padding: spacing.lg }}>
                  Loading…
                </AppText>
              ) : status === 'error' ? (
                <AppText muted style={{ padding: spacing.lg }}>
                  {error}
                </AppText>
              ) : items.length === 0 ? (
                <AppText muted style={{ padding: spacing.lg }}>
                  No notifications yet.
                </AppText>
              ) : (
                items
                  .slice(0, 8)
                  .map((item) => (
                    <NotificationRow key={item.id} item={item} onPress={() => openItem(item)} />
                  ))
              )}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setOpen(false);
                onViewAll();
              }}
              style={styles.bellFooter}
            >
              <AppText size={13} bold style={{ color: c.brand, textAlign: 'center' }}>
                View all
              </AppText>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function NavLink({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.navLink}
    >
      <AppText bold={active} size={14} style={{ color: active ? c.text : c.textSecondary }}>
        {label}
      </AppText>
      {active && <View style={styles.navLinkUnderline} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: '100%' as unknown as number,
  },
  navbar: {
    borderBottomWidth: 1,
    borderBottomColor: c.line,
    backgroundColor: c.canvas,
    position: 'sticky' as unknown as 'relative',
    top: 0,
    zIndex: 10,
  },
  // `alignSelf: "flex-start"`, not "center" — founder feedback (22 Oct 2026): on a screen wider
  // than 1280px, centering this whole bar left equal dead space on both sides, which read as the
  // logo and Home/Discover links floating in the middle of the window instead of anchored to its
  // left edge. `searchOuter` below already absorbs whatever space is left over to the right of the
  // nav links, same reasoning this already used for the search bar itself (see `search` below).
  navbarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  logo: { paddingVertical: 4 },
  navLinks: { flexDirection: 'row', gap: spacing.lg },
  navLink: { paddingVertical: 4 },
  navLinkUnderline: {
    marginTop: 4,
    height: 2,
    borderRadius: 1,
    backgroundColor: c.brand,
  },
  // `searchOuter` is the real flex item: it consumes all remaining row space (no maxWidth), which
  // is what pushes `navActions` to the navbar's true right edge. `search` anchors LEFT (flex-start)
  // inside that space instead of centering — founder feedback (18 Oct 2026): the centered search
  // left symmetric dead gaps on both sides, which made the whole bar read "centered" with white
  // space left and right of it. Left-anchored, every bar element after the logo packs leftward and
  // only the residual space sits before the right-hand actions.
  searchOuter: { flex: 1 },
  search: { width: '100%', maxWidth: 420, alignSelf: 'flex-start' },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sellPill: {
    backgroundColor: c.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: c.live,
  },
  bellOverlay: {
    position: 'fixed' as unknown as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 19,
  },
  bellPanel: {
    position: 'absolute',
    top: 44,
    right: 0,
    width: 360,
    maxHeight: 440,
    overflow: 'hidden',
    backgroundColor: c.canvas,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: radii.card,
    zIndex: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  bellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderColor: c.line,
  },
  bellFooter: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderColor: c.line,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
  },
  // The narrow (non-"wide") screens get this inner cap instead of narrowing `content` itself.
  // `content` always matches `navbarInner`'s box (same maxWidth, same centering), so its left edge
  // lines up with the navbar's left edge (the logo) — this wrapper then hugs that same left edge
  // (`alignSelf: "flex-start"`, not "center") instead of centering independently in the full page
  // width, which is what made Profile/Seller studio look shifted right of the navbar.
  contentNarrow: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'flex-start',
  },
  toast: {
    position: 'absolute',
    left: '50%' as unknown as number,
    bottom: 32,
    transform: [{ translateX: -160 }],
    width: 320,
    backgroundColor: tokens.colors.toast,
    borderRadius: tokens.radii.button,
    padding: 18,
    elevation: 8,
  },
});
