import React, { useEffect, useRef, useState } from 'react';
import { View, FlatList, Platform, Animated, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button } from './components';
import { colors as c, spacing } from './theme';
import { useLiveFeed } from './hooks/useLiveFeed';
import { LiveReel } from './components/live/LiveReel';
import { LiveFeedHint, type LiveFeedHintHandle } from './components/live/LiveFeedHint';
import { useApp } from './context';
import { ROUTES } from './constants/routes';

// The app's own Live screen — a vertically-paged reel feed, each page a full-bleed video with
// overlaid chat/bid UI. This is the single source of truth for that layout: the native entry
// point (`Live.tsx`) re-exports it unchanged, and the web entry point (`Live.web.tsx`) renders it
// too at phone-width viewports, so "web on a phone browser looks like the app" holds here the same
// way it does for the tab shell. Only `Live.web.tsx` has a second, desktop-only layout.
export function LiveMobileShell({
  streamId,
  navVisible,
  onNavVisibility,
}: {
  streamId: string;
  navVisible: boolean;
  onNavVisibility: (visible: boolean) => void;
}) {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { sessions, loadError, index, setIndex } = useLiveFeed(streamId);
  const list = useRef<FlatList>(null);
  const hint = useRef<LiveFeedHintHandle>(null);
  // Sound is on by default on phones. Browsers block sound until the user has tapped the page, so
  // on web the feed starts muted and the first tap turns the sound on.
  const [muted, setMuted] = useState(Platform.OS === 'web');
  const [flash, setFlash] = useState(0);
  // Confirmed via a real-device debug overlay (27 Oct 2026): `onLayout` below never fires in this
  // web context (stayed `null` for the whole session), and the old `height - 130` fallback was a
  // guess at reserving space for the bottom tab bar — but `LiveMobileShell` only ever renders while
  // `dark` is true back in `MainTabShell` (the Live tab, no sub-route), and in that state the tab
  // bar is transparent and absolutely positioned over the content, not pushing it up. The parent
  // already gives this screen the real full height with nothing to subtract; subtracting 130 here
  // too just left that same 130px as a dead gap below the reel. `insets.top` is still subtracted
  // since `MainTabShell` applies it as `paddingTop` one level up, outside what `height` measures.
  const viewport = Math.max(320, height - insets.top);

  // Scrolls to the requested session as soon as the list is ready. Computes its own target
  // (rather than reading `index` from the hook) since the hook's own `setIndex` for the same
  // event lands on the next render, one tick after this effect would otherwise fire.
  useEffect(() => {
    if (!sessions || sessions.length === 0) return;
    const i = Math.max(
      0,
      sessions.findIndex((s) => s.id === streamId),
    );
    list.current?.scrollToIndex({ index: i, animated: false });
  }, [streamId, sessions]);

  const navSpace = 56 + Math.max(insets.bottom, 10);
  const hiddenSpace = 16 + Math.max(insets.bottom, 10);
  const barPad = useRef(new Animated.Value(navVisible ? navSpace : hiddenSpace)).current;
  useEffect(() => {
    Animated.timing(barPad, {
      toValue: navVisible ? navSpace : hiddenSpace,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [navVisible]);

  // Hide the bottom bar after 40 seconds on the same live. Swiping to another live, or tapping the
  // screen, shows it again and restarts the countdown — founder feedback (22 Oct 2026): once hidden
  // it never came back on its own, since nothing but changing `index` used to call this.
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNav = () => {
    if (navTimer.current) clearTimeout(navTimer.current);
    onNavVisibility(true);
    navTimer.current = setTimeout(() => onNavVisibility(false), 40000);
  };
  useEffect(() => {
    showNav();
    return () => {
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, [index]);

  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );
  function onReelTap() {
    showNav();
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      return;
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      setMuted((m) => !m);
      setFlash((f) => f + 1);
    }, 260);
  }

  const viewability = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewable = useRef(({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    const visible = viewableItems.find((v) => v.index !== null);
    if (visible && visible.index !== null) setIndex(visible.index);
  }).current;

  if (sessions === null) {
    return (
      <View
        style={{ flex: 1, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}
      >
        <AppText white muted={!loadError}>
          {loadError || "Loading what's live…"}
        </AppText>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.ink,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.xxl,
        }}
      >
        <AppText white bold size={18} style={{ textAlign: 'center' }}>
          Nothing is live right now
        </AppText>
        <AppText white size={14} style={{ textAlign: 'center', opacity: 0.7 }}>
          Check back soon, or browse what's in the catalog.
        </AppText>
        <Button label="Browse Discover" onPress={() => app.navigate(ROUTES.DISCOVER)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.ink }}>
      <FlatList
        ref={list}
        data={sessions}
        keyExtractor={(s) => s.id}
        pagingEnabled
        snapToInterval={viewport}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        initialNumToRender={1}
        windowSize={3}
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: viewport, offset: viewport * i, index: i })}
        extraData={{ index, muted, flash }}
        viewabilityConfig={viewability}
        onViewableItemsChanged={onViewable}
        onScrollBeginDrag={() => hint.current?.dismiss()}
        renderItem={({ item, index: i }) => (
          <View style={{ height: viewport, width: '100%', backgroundColor: c.ink }}>
            <LiveReel
              session={item}
              active={i === index}
              muted={muted}
              flash={flash}
              barPad={barPad}
              onReelTap={onReelTap}
            />
          </View>
        )}
      />
      {sessions.length > 1 ? <LiveFeedHint ref={hint} variant="mobile" /> : null}
    </View>
  );
}
