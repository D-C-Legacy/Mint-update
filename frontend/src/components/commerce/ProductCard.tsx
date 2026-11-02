import * as tokens from "../../theme";
import React, { useState } from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import { formatUSD } from "../../theme";
import type { CardProduct } from "../../api/catalog";
import { AppText, Photo } from "../ui";

// A product tile. A null price means the product has no open sale right now.
export function ProductCard({ product, onPress }: { product: CardProduct; onPress: () => void }) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityLabel={`View ${product.title}`}
      style={({ pressed: p }) => [
        styles.card,
        p && styles.cardPressed,
        { width: "48%", marginBottom: 18 },
      ]}
    >
      <Photo
        uri={product.image}
        style={styles.image}
      />
      <View style={styles.content}>
        <AppText size={13} bold style={{ marginTop: tokens.spacing.sm }} numberOfLines={2}>
          {product.title}
        </AppText>
        <AppText size={15} bold style={{ marginTop: 2 }}>
          {product.price === null ? "Not for sale" : formatUSD(product.price)}
        </AppText>
        <AppText muted size={11} numberOfLines={1}>
          {product.detail}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: tokens.colors.canvas,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      },
    }),
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    ...Platform.select({
      web: {
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
      },
    }),
  },
  image: {
    width: "100%",
    aspectRatio: 1.2,
    borderRadius: 0,
  },
  content: {
    padding: tokens.spacing.sm,
    paddingBottom: tokens.spacing.md,
  },
});
