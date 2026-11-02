import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { AppText } from "../ui";
import { InitialsAvatar } from "./InitialsAvatar";
import { colors as c, spacing, formatUSD } from "../../theme";
import type { SessionPurchase } from "../../api/streams";

const VISIBLE_COUNT = 4;
const ITEM_HEIGHT = 44;
const CYCLE_DURATION = 3000;

interface PurchaseTickerProps {
  purchases: SessionPurchase[];
  visibleCount?: number;
}

export function PurchaseTicker({ purchases, visibleCount = VISIBLE_COUNT }: PurchaseTickerProps) {
  // Hooks first — a conditional return before useState/useEffect breaks the rules of hooks.
  const [animatedItems, setAnimatedItems] = useState<SessionPurchase[]>(
    purchases.slice(0, visibleCount)
  );
  const translateY = useRef(new Animated.Value(0)).current;
  const cycleRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Cycle through the feed
  useEffect(() => {
    if (purchases.length <= visibleCount) return;

    const cycle = () => {
      translateY.setValue(0);
      Animated.timing(translateY, {
        toValue: -ITEM_HEIGHT,
        duration: CYCLE_DURATION,
        useNativeDriver: true,
      }).start(() => {
        cycleRef.current = (cycleRef.current + 1) % purchases.length;
        const nextIndex = (cycleRef.current + visibleCount) % purchases.length;
        const next = purchases[nextIndex];
        if (next) {
          setAnimatedItems([...animatedItems.slice(1), next]);
          translateY.setValue(0);
        }
        timeoutRef.current = setTimeout(cycle, 2000);
      });
    };

    timeoutRef.current = setTimeout(cycle, 2000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [purchases, animatedItems, translateY, visibleCount]);

  // When new purchases arrive, prepend them
  useEffect(() => {
    if (purchases.length > 0 && purchases[0] !== animatedItems[0]) {
      // New purchase at the front - if we're not already showing it, update
      const newItems = purchases.slice(0, visibleCount);
      if (JSON.stringify(newItems.map(i => i.saleId)) !== JSON.stringify(animatedItems.map(i => i.saleId))) {
        setAnimatedItems(newItems);
        cycleRef.current = 0;
      }
    }
  }, [purchases, animatedItems, visibleCount]);

  if (purchases.length === 0) return null;

  const renderItem = (item: SessionPurchase, index: number) => {
    const amount = formatUSD(Number(item.finalAmount) / 100);
    return (
      <View
        key={item.saleId}
        style={[
          styles.item,
          { transform: [{ translateY: translateY.interpolate({
            inputRange: [0, 1],
            outputRange: [index * ITEM_HEIGHT, (index - 1) * ITEM_HEIGHT],
          }) }] }
        ]}
      >
        <InitialsAvatar name={item.winnerDisplayName || item.winnerUserId} size={28} />
        <View style={styles.textWrap}>
          <AppText bold size={12} white numberOfLines={1}>
            {item.winnerDisplayName || "Someone"}
          </AppText>
          <AppText size={11} style={{ color: "rgba(255,255,255,0.7)" }} numberOfLines={1}>
            {item.productTitle ? `${item.productTitle} · ${amount}` : amount}
          </AppText>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { height: visibleCount * ITEM_HEIGHT }]} pointerEvents="none">
      <Animated.View style={styles.animatedContainer}>
        {animatedItems.map(renderItem)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  animatedContainer: {
    flex: 1,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: ITEM_HEIGHT,
    paddingHorizontal: spacing.md,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
});