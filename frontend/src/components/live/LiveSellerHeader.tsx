import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Avatar } from '../ui';
import { radii, spacing, colors } from '../../theme';

const shadow = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowRadius: 4,
  textShadowOffset: { width: 0, height: 1 },
};

// The stream's own title, shown as its own banner line above the seller row — not tucked under
// the seller's name as a small subtitle (founder feedback, 26 Oct 2026: the title needs real
// visual weight of its own, separate from seller identity, same as the reference layout he sent).
export function LiveStreamTitle({ title }: { title: string }) {
  if (!title) return null;
  return (
    <AppText white bold size={18} style={[{ marginBottom: 4 }, shadow]}>
      {title}
    </AppText>
  );
}

// One row, like Instagram Reels: the seller (channel banner and name) on the left, with the
// Follow button beside the name — real `followChannel`/`unfollowChannel` calls, same pattern as
// SellerProfile.tsx. Following turns the button into a bell that springs in. Tapping the bell
// switches notifications on or off, as on YouTube: on shows a filled bell that wiggles, off shows
// an outline bell. Long-press the bell to unfollow. The live viewer count sits on the right.
export function LiveSellerHeader({
  name,
  avatarUri,
  viewerCount,
  following,
  followBusy,
  onSeller,
  onFollow,
}: {
  name: string;
  avatarUri: string;
  viewerCount: number;
  following: boolean | null;
  followBusy: boolean;
  onSeller: () => void;
  onFollow: () => void;
}) {
  const bell = useRef(new Animated.Value(0)).current;
  const swing = useRef(new Animated.Value(0)).current;
  const [notify, setNotify] = useState(false);
  const wasFollowing = useRef(following);

  // Bell springs in the moment the seller is followed.
  useEffect(() => {
    if (following && !wasFollowing.current) {
      bell.setValue(0);
      Animated.spring(bell, {
        toValue: 1,
        friction: 4,
        tension: 140,
        useNativeDriver: true,
      }).start();
      // Notifications are on by default once you follow; the bell can switch them off.
      setNotify(true);
    }
    if (!following) setNotify(false);
    wasFollowing.current = following;
  }, [following]);

  // Wiggle each time notifications are switched on.
  function toggleNotify() {
    const next = !notify;
    setNotify(next);
    if (next) {
      swing.setValue(0);
      Animated.sequence([
        Animated.timing(swing, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(swing, { toValue: -1, duration: 90, useNativeDriver: true }),
        Animated.timing(swing, { toValue: 0.6, duration: 80, useNativeDriver: true }),
        Animated.timing(swing, { toValue: -0.6, duration: 80, useNativeDriver: true }),
        Animated.timing(swing, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start();
    }
  }

  const swingDeg = swing.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-18deg', '18deg'],
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Visit ${name}`}
        onPress={onSeller}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 }}
      >
        <Avatar uri={avatarUri} size={34} />
        <AppText white bold size={14} style={[{ flexShrink: 1 }, shadow]}>
          {name}
        </AppText>
      </Pressable>

      {following === null ? null : following ? (
        <Animated.View style={{ transform: [{ scale: bell }, { rotate: swingDeg }] }}>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: notify }}
            accessibilityLabel={
              notify
                ? 'Notifications on. Long press to unfollow'
                : 'Notifications off. Long press to unfollow'
            }
            onPress={toggleNotify}
            onLongPress={onFollow}
            style={({ pressed }) => ({
              height: 26,
              width: 30,
              borderRadius: radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: notify ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.22)',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons
              name={notify ? 'notifications' : 'notifications-outline'}
              size={15}
              color={notify ? '#111113' : '#FFFFFF'}
            />
          </Pressable>
        </Animated.View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Follow seller"
          disabled={followBusy}
          onPress={onFollow}
          style={({ pressed }) => ({
            height: 24,
            paddingHorizontal: 10,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.95)',
            opacity: pressed || followBusy ? 0.6 : 1,
          })}
        >
          <AppText size={11} bold style={{ color: '#111113' }}>
            Follow
          </AppText>
        </Pressable>
      )}

      <View style={{ flex: 1 }} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          height: 24,
          paddingHorizontal: 9,
          borderRadius: radii.pill,
          backgroundColor: 'rgba(16,16,20,0.45)',
        }}
      >
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live }} />
        <AppText white bold size={11}>
          {viewerCount}
        </AppText>
      </View>
    </View>
  );
}
