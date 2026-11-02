import * as tokens from "../../theme";
import { colors as c } from "../../theme";
import React from "react";
import { View } from "react-native";
import { AppText, Chips, EmptyState } from "../../components";
import type { CardProduct } from "../../api/catalog";
import type { ChannelSummary } from "../../api/channels";
import type { ReviewView } from "../../api/reviews";
import { ProductGrid } from "./shared";

// The tabbed part of a seller's public page (Shop grid / Reviews / About), shared by the mobile
// layout and the desktop 2-column layout.
export function SellerContent({
  tab,
  onTab,
  cards,
  reviews,
  channel,
}: {
  tab: string;
  onTab: (tab: string) => void;
  cards: CardProduct[];
  reviews: ReviewView[];
  channel: ChannelSummary;
}) {
  return (
    <>
      <Chips items={["Shop", "Reviews", "About"]} value={tab} onChange={onTab} />
      {tab === "Shop" ? (
        <ProductGrid items={cards} />
      ) : tab === "Reviews" ? (
        reviews.length === 0 ? (
          <EmptyState title="No reviews yet" detail="Reviews show up here once buyers leave them." />
        ) : (
          <View style={{ gap: tokens.spacing.md }}>
            {reviews.map((review) => (
              <View
                key={review.id}
                style={{ gap: 4, paddingVertical: tokens.spacing.md, borderBottomWidth: 1, borderColor: c.line }}
              >
                <AppText bold>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</AppText>
                {review.body ? <AppText>{review.body}</AppText> : null}
                <AppText muted size={11}>
                  {new Date(review.createdAt).toLocaleDateString()}
                </AppText>
                {review.sellerResponseBody ? (
                  <View style={{ marginTop: 6, paddingLeft: tokens.spacing.md, borderLeftWidth: 2, borderColor: c.line }}>
                    <AppText muted size={12} bold>
                      Seller response
                    </AppText>
                    <AppText size={13}>{review.sellerResponseBody}</AppText>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )
      ) : (
        <View style={{ gap: tokens.spacing.md }}>
          <AppText>{channel.bio ?? "This seller has not written a bio yet."}</AppText>
          <AppText muted>Joined {new Date(channel.createdAt).toLocaleDateString()}</AppText>
        </View>
      )}
    </>
  );
}
