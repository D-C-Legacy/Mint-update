import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Icon } from '../ui';
import { spacing } from '../../theme';
import { hasSeenLiveFeedHint, markLiveFeedHintSeen } from '../../utils/seen-hint';

const AUTO_DISMISS_MS = 4000;

export type LiveFeedHintHandle = {
  dismiss: () => void;
};

// Shown once (per device on web, per app-session on native — see seen-hint.ts) over the live
// feed, telling the viewer how to move to another stream. Desktop web has no native swipe, so it
// gets the keyboard/wheel copy; mobile already has FlatList paging and just needs the nudge.
export const LiveFeedHint = forwardRef<LiveFeedHintHandle, { variant: 'mobile' | 'desktop' }>(
  function LiveFeedHint({ variant }, ref) {
    const [shown, setShown] = useState(() => !hasSeenLiveFeedHint());
    const dismissed = useRef(false);

    const dismiss = () => {
      if (dismissed.current) return;
      dismissed.current = true;
      setShown(false);
      markLiveFeedHintSeen();
    };

    useImperativeHandle(ref, () => ({ dismiss }));

    useEffect(() => {
      if (!shown) return;
      const t = setTimeout(dismiss, AUTO_DISMISS_MS);
      return () => clearTimeout(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shown]);

    if (!shown) return null;

    return (
      <View style={styles.wrap} pointerEvents="none">
        <View style={styles.pill}>
          <Icon
            name={variant === 'mobile' ? 'chevron-up' : 'swap-vertical'}
            size={16}
            color="#FFFFFF"
          />
          <AppText white size={13} bold>
            {variant === 'mobile' ? 'Swipe up for more' : 'Scroll or press ↑ / ↓ to browse'}
          </AppText>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(16,16,20,0.7)',
  },
});
