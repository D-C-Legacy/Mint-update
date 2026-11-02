import React, { useState } from "react";
import { View } from "react-native";
import { AppText, Button, EmptyState, Field, Screen, Section } from "../../components";
import { Card } from "../../components/ui/Card";
import { useApp } from "../../hooks";
import { useAsync } from "../../api/use-async";
import { describeApiError } from "../../api/describe-error";
import { getMySeller } from "../../api/seller";
import { listSellerReviews, respondToReview, type ReviewView } from "../../api/reviews";
import { spacing } from "../../theme";

type ReviewsData = {
  reviews: ReviewView[];
  summary: { averageRating: number; reviewCount: number };
};

async function loadMyReviews(): Promise<ReviewsData> {
  const seller = await getMySeller();
  if (!seller) return { reviews: [], summary: { averageRating: 0, reviewCount: 0 } };
  const page = await listSellerReviews(seller.id);
  return { reviews: page.items, summary: page.summary };
}

function ReviewRow({ review, onResponded }: { review: ReviewView; onResponded: (r: ReviewView) => void }) {
  const app = useApp();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const updated = await respondToReview(review.id, reply.trim());
      onResponded(updated);
      setReplying(false);
      setReply("");
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: spacing.sm, marginBottom: spacing.md }}>
      <AppText bold>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</AppText>
      {review.body ? <AppText>{review.body}</AppText> : null}
      <AppText muted size={11}>
        {new Date(review.createdAt).toLocaleDateString()}
      </AppText>
      {review.sellerResponseBody ? (
        <View style={{ marginTop: 6, paddingLeft: spacing.md, borderLeftWidth: 2 }}>
          <AppText muted size={12} bold>
            Your response
          </AppText>
          <AppText size={13}>{review.sellerResponseBody}</AppText>
        </View>
      ) : replying ? (
        <View style={{ gap: spacing.sm }}>
          <Field placeholder="Write a public response…" value={reply} onChange={setReply} multiline />
          <Button label="Post response" loading={busy} disabled={!reply.trim()} onPress={submit} />
        </View>
      ) : (
        <Button secondary label="Respond" onPress={() => setReplying(true)} />
      )}
    </Card>
  );
}

// Real as of Phase 8 — the seller's own received reviews, reached from the seller dashboard
// menu. Was an in-memory mock before. GET /v1/sellers/:sellerId/reviews is the same public
// listing a buyer sees on SellerProfile; a seller can additionally respond to each one.
export function ReviewsScreen({ inline = false }: { inline?: boolean }) {
  const app = useApp();
  return (
    <Screen title="Your reviews" onBack={inline ? undefined : app.back}>
      <ReviewsContent />
    </Screen>
  );
}

// Content-only body, also reused inside the seller portal's Reviews pane
// (`SellerPortal.web.tsx`) with no Screen chrome.
export function ReviewsContent() {
  const detail = useAsync(loadMyReviews, []);
  const [overrides, setOverrides] = useState<Record<string, ReviewView>>({});

  if (detail.state.status === "loading") return <AppText muted>Loading…</AppText>;
  if (detail.state.status === "error") {
    return <EmptyState title="Couldn't load reviews" detail={detail.state.message} />;
  }

  const { reviews, summary } = detail.state.data;

  return (
    <>
      <AppText muted>Good experiences make a great community.</AppText>
      <Section
        title={
          summary.reviewCount > 0
            ? `★ ${summary.averageRating.toFixed(1)} · ${summary.reviewCount} review${summary.reviewCount === 1 ? "" : "s"}`
            : "No reviews yet"
        }
      />
      {reviews.length === 0 ? (
        <EmptyState title="No reviews yet" detail="Reviews from buyers show up here once an order is delivered." />
      ) : (
        reviews.map((review) => (
          <ReviewRow
            key={review.id}
            review={overrides[review.id] ?? review}
            onResponded={(r) => setOverrides((prev) => ({ ...prev, [r.id]: r }))}
          />
        ))
      )}
    </>
  );
}
