import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppText, Button, Icon } from './components';
import { colors as c, spacing } from './theme';
import { useLiveFeed } from './hooks/useLiveFeed';
import { LiveReelDesktop } from './components/live/LiveReelDesktop';
import { LiveMobileShell } from './LiveMobileShell';
import { LiveFeedHint, type LiveFeedHintHandle } from './components/live/LiveFeedHint';
import { useApp } from './context';
import { ROUTES } from './constants/routes';

// One wheel gesture (trackpad or mouse) fires many small `wheel` events — without a cooldown, a
// single swipe would skip through several streams at once. This limits it to one step per window.
const WHEEL_COOLDOWN_MS = 480;

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile reel feed the app uses
// (`LiveMobileShell`) — web on a phone-width browser must look like the app. At/above it, this
// renders the Instagram-style split view (`LiveReelDesktop`): video left, chat/bid panel right,
// under the desktop navbar `MainTabNavigator.web.tsx` already renders above it.
const DESKTOP_BREAKPOINT = 768;

export function Live({
  streamId,
  navVisible,
  onNavVisibility,
}: {
  streamId: string;
  navVisible: boolean;
  onNavVisibility: (visible: boolean) => void;
}) {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT) {
    return (
      <LiveMobileShell
        streamId={streamId}
        navVisible={navVisible}
        onNavVisibility={onNavVisibility}
      />
    );
  }
  return <DesktopLive streamId={streamId} />;
}

function DesktopLive({ streamId }: { streamId: string }) {
  const app = useApp();
  const { sessions, loadError, index, setIndex } = useLiveFeed(streamId);
  const hint = useRef<LiveFeedHintHandle>(null);
  const lastWheelTick = useRef(0);
  const sessionCount = sessions?.length ?? 0;

  useEffect(() => {
    if (sessionCount === 0) return;

    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        setIndex((i) => Math.max(0, i - 1));
        hint.current?.dismiss();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        setIndex((i) => Math.min(sessionCount - 1, i + 1));
        hint.current?.dismiss();
      }
    }

    function onWheel(e: WheelEvent) {
      const now = Date.now();
      if (now - lastWheelTick.current < WHEEL_COOLDOWN_MS) return;
      lastWheelTick.current = now;
      if (e.deltaY > 0) setIndex((i) => Math.min(sessionCount - 1, i + 1));
      else if (e.deltaY < 0) setIndex((i) => Math.max(0, i - 1));
      hint.current?.dismiss();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('wheel', onWheel);
    };
  }, [sessionCount, setIndex]);

  if (sessions === null) {
    return (
      <View style={styles.center}>
        <AppText muted={!loadError}>{loadError || "Loading what's live…"}</AppText>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={[styles.center, { gap: spacing.md }]}>
        <AppText bold size={18}>
          Nothing is live right now
        </AppText>
        <AppText muted size={14}>
          Check back soon, or browse what's in the catalog.
        </AppText>
        <Button label="Browse Discover" onPress={() => app.navigate(ROUTES.DISCOVER)} />
      </View>
    );
  }

  const session = sessions[index] ?? sessions[0]!;

  return (
    <View style={{ flex: 1 }}>
      <LiveReelDesktop key={session.id} session={session} active />
      {sessions.length > 1 ? <LiveFeedHint ref={hint} variant="desktop" /> : null}
      {sessions.length > 1 ? (
        <View style={styles.switcher} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous live"
            disabled={index === 0}
            onPress={() => {
              setIndex((i) => Math.max(0, i - 1));
              hint.current?.dismiss();
            }}
            style={[styles.switchBtn, { opacity: index === 0 ? 0.3 : 1 }]}
          >
            <Icon name="chevron-up" color="#FFFFFF" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next live"
            disabled={index === sessions.length - 1}
            onPress={() => {
              setIndex((i) => Math.min(sessions.length - 1, i + 1));
              hint.current?.dismiss();
            }}
            style={[styles.switchBtn, { opacity: index === sessions.length - 1 ? 0.3 : 1 }]}
          >
            <Icon name="chevron-down" color="#FFFFFF" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcher: {
    position: 'absolute',
    left: spacing.lg,
    top: '50%' as unknown as number,
    gap: spacing.sm,
  },
  switchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,16,20,0.55)',
  },
});
