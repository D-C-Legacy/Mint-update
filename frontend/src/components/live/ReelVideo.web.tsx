import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Hls from 'hls.js';
import { Feather } from '@expo/vector-icons';

// Web override of `ReelVideo.tsx`. `expo-video`'s web player sets the HLS `.m3u8` URL directly as a
// <video src>, which only plays in Safari — Chrome, Edge, and Firefox have no native HLS support in
// <video>, so Amazon IVS's playback URLs rendered a permanently blank frame there regardless of OBS
// being perfectly stable (founder-reported, 26 Oct 2026: "web still doesn't work... blank screen").
// hls.js parses the HLS manifest via MediaSource Extensions so the same stream plays on Chromium/
// Firefox too. Safari isn't given hls.js at all (`Hls.isSupported()` is false there, MSE already
// works natively), so it keeps using its own native HLS support directly.
//
// The <video> element itself is created with `document.createElement` rather than JSX — this repo
// has no `@types/react-dom`/DOM JSX intrinsics wired up, and a raw DOM element avoids that entirely
// while still being fully typed via `lib: DOM` (already in tsconfig).
const STALL_TIMEOUT_MS = 8_000;
const RELOAD_COOLDOWN_MS = 5_000;

export function ReelVideo({
  source,
  active,
  muted,
  flash,
  volume,
}: {
  source: string;
  active: boolean;
  muted: boolean;
  flash: number;
  // 0-1. Web only (browsers have no hardware volume buttons); defaults to full, same as a fresh
  // <video> element's own default.
  volume?: number;
}) {
  const containerRef = useRef<View>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    // `View`'s ref is the underlying <div> on web — there's no RNW-typed way to express that, hence
    // the double cast rather than `any`.
    const container = containerRef.current as unknown as HTMLDivElement | null;
    if (!container) return;

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = muted;
    video.volume = volume ?? 1;
    Object.assign(video.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    });
    container.appendChild(video);
    videoElRef.current = video;

    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(source);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        // eslint-disable-next-line no-console
        console.warn(`[ReelVideo.web] fatal hls.js error: ${data.type}`);
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          hls.destroy();
          hlsRef.current = new Hls({ lowLatencyMode: true });
          hlsRef.current.loadSource(source);
          hlsRef.current.attachMedia(video);
        }
      });
    } else {
      // Safari: native HLS support, no hls.js needed.
      video.src = source;
    }
    if (activeRef.current) video.play().catch(() => {});

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      container.removeChild(video);
      videoElRef.current = null;
    };
  }, [source]);

  useEffect(() => {
    if (videoElRef.current) videoElRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (videoElRef.current) videoElRef.current.volume = volume ?? 1;
  }, [volume]);

  useEffect(() => {
    const video = videoElRef.current;
    if (!video) return;
    if (active) video.play().catch(() => {});
    else video.pause();
  }, [active]);

  // Stall recovery: hls.js can fall behind the live edge without ever emitting a fatal error, same
  // as the native player — `startLoad()` is hls.js's own documented way to resume from that; Safari's
  // native HLS has no equivalent, so it gets a plain reload of the source instead.
  const lastProgressRef = useRef(Date.now());

  useEffect(() => {
    if (active) lastProgressRef.current = Date.now();
    const video = videoElRef.current;
    if (!video) return;

    function onTimeUpdate() {
      lastProgressRef.current = Date.now();
    }
    video.addEventListener('timeupdate', onTimeUpdate);

    const stallCheck = setInterval(() => {
      if (!active || Date.now() - lastProgressRef.current <= STALL_TIMEOUT_MS) return;
      if (Date.now() - lastProgressRef.current <= STALL_TIMEOUT_MS + RELOAD_COOLDOWN_MS) return;
      lastProgressRef.current = Date.now();
      // eslint-disable-next-line no-console
      console.warn('[ReelVideo.web] reloading after stalled live edge');
      if (hlsRef.current) {
        hlsRef.current.startLoad();
      } else {
        video.load();
        video.play().catch(() => {});
      }
    }, 2_000);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      clearInterval(stallCheck);
    };
  }, [active]);

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;
  const mounted = useRef(false);

  useEffect(() => {
    // Skip the first render so the icon does not appear before anyone has tapped.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!active) return;
    opacity.setValue(1);
    scale.setValue(0.6);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [flash]);

  return (
    <View style={styles.frame} pointerEvents="none">
      <View ref={containerRef} style={styles.video} />
      <View style={styles.centre} pointerEvents="none">
        <Animated.View style={[styles.badge, { opacity, transform: [{ scale }] }]}>
          <Feather name={muted ? 'volume-x' : 'volume-2'} size={28} color="#FFFFFF" />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  centre: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,16,20,0.55)',
  },
});
