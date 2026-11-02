import * as tokens from '../theme';
import { RouteNavigator } from './RouteNavigator';
import { useMarketplaceState } from '../hooks/useMarketplaceState';

import { ROUTES } from '../constants/routes';
import { TABS } from '../constants/routes';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppContext } from '../context';

import { colors as c } from '../theme';
import { AppText } from '../components';
import { Live } from '../Live';
import { Discover } from '../Marketplace';
import { SellHub } from '../Seller';
import { Inbox, Settings } from '../Personal';
import { useNavigation } from '../hooks/useNavigation';
import { useNotifications } from '../hooks/useNotifications';
import { useMessaging } from '../hooks/useMessaging';
const tabs = TABS;

// The app's own mobile-shaped layout — bottom tab bar, phone-frame width. This is the single
// source of truth for that layout: the native entry point (`MainTabNavigator.tsx`) re-exports it
// unchanged, and the web entry point (`MainTabNavigator.web.tsx`) renders it too at phone-width
// viewports, so "web on a phone browser looks like the app" never drifts from what the app
// actually looks like. Only `MainTabNavigator.web.tsx` has a second, desktop-only layout.
export function MainTabShell() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const { tab, setTab, routes, setRoutes, back, navigate, selectStream, stream } = useNavigation();
  const market = useMarketplaceState();
  const { unreadCount: unreadNotifications } = useNotifications();
  const { unreadCount: unreadMessages } = useMessaging();
  const [notice, setNotice] = useState('');
  const route = routes[routes.length - 1];
  const dark = tab === ROUTES.LIVE && !route;
  // On a live, the bottom bar slides away after 40 seconds on one stream. Leaving the tab, or
  // moving to another stream, brings it back.
  const [navVisible, setNavVisible] = useState(true);
  const navSlide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setNavVisible(true);
  }, [tab, route]);
  useEffect(() => {
    Animated.timing(navSlide, {
      toValue: navVisible ? 0 : 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [navVisible]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3200);
    return () => clearTimeout(t);
  }, [notice]);
  const context = { navigate, back, toast: setNotice, selectStream, ...market };
  function renderRoute() {
    if (!route) {
      switch (tab) {
        case ROUTES.LIVE:
          return <Live streamId={stream} navVisible={navVisible} onNavVisibility={setNavVisible} />;
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
      <View style={styles.desktop}>
        <View
          style={[
            styles.app,
            {
              paddingTop: insets.top,
              backgroundColor: dark ? c.ink : c.canvas,
            },
            // The 960px cap + boxed shadow is a phone-frame preview for a desktop browser window
            // narrowed below the mobile breakpoint — on a real phone (window already <=960 tall,
            // true for virtually every real device) this must not apply at all, or it caps the
            // live app's real height short of the actual screen and leaves dead space below it
            // (founder-reported, 26-27 Oct 2026: "show the full stream, no gap from the bottom").
            Platform.OS === 'web' && windowHeight > 960
              ? { maxHeight: 960, overflow: 'hidden' as const, boxShadow: '0 10px 70px #00000012' }
              : null,
          ]}
        >
          <StatusBar style={dark ? 'light' : 'dark'} />
          <View
            style={{ flex: 1, paddingBottom: dark ? 0 : 64 + Math.max(insets.bottom, 10) }}
            key={route ? route.name + routes.length : tab}
          >
            {renderRoute()}
          </View>
          <Animated.View
            style={[
              styles.nav,
              {
                paddingBottom: Math.max(insets.bottom, 10),
                backgroundColor: dark ? 'transparent' : c.canvas,
                borderTopColor: dark ? 'transparent' : c.line,
                transform: [
                  {
                    translateY: navSlide.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 140],
                    }),
                  },
                ],
              },
            ]}
          >
            {tabs.map((t) => (
              <Pressable
                key={t.name}
                accessibilityRole="tab"
                accessibilityLabel={t.name}
                accessibilityState={{ selected: tab === t.name }}
                onPress={() => {
                  setTab(t.name);
                  setRoutes([]);
                }}
                style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons
                  name={tab === t.name ? t.selected : t.icon}
                  color={dark ? '#FFFFFF' : tab === t.name ? c.brand : c.textSecondary}
                  size={22}
                />
                <AppText
                  size={10}
                  style={{
                    color: dark ? '#FFFFFF' : tab === t.name ? c.brand : c.textSecondary,
                  }}
                >
                  {t.label}
                </AppText>
                {t.name === ROUTES.INBOX && (unreadMessages > 0 || unreadNotifications > 0) && (
                  <View style={styles.dot} />
                )}
              </Pressable>
            ))}
          </Animated.View>
          {notice !== '' && (
            <Pressable
              accessibilityRole="alert"
              onPress={() => setNotice('')}
              style={[styles.toast, { bottom: 85 + insets.bottom }]}
            >
              <AppText white size={13}>
                {notice}
              </AppText>
            </Pressable>
          )}
        </View>
      </View>
    </AppContext.Provider>
  );
}
const styles = StyleSheet.create({
  iconRing: {
    width: 36,
    height: 32,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktop: {
    flex: 1,
    backgroundColor: tokens.colors.desktop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  app: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
  },
  nav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    gap: tokens.spacing.xs,
  },
  dot: {
    position: 'absolute',
    top: 0,
    right: '30%',
    width: 5,
    height: 5,
    backgroundColor: c.live,
    borderRadius: 5,
  },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: tokens.colors.toast,
    borderRadius: tokens.radii.button,
    padding: 18,
    elevation: 8,
  },
});
