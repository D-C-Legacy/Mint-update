// Typed wrappers around the admin review-moderation routes (Phase 8 — not in 05-API-SPEC.md,
// no review model exists in the docs at all). Shapes mirror reviews/api/http/review.view.ts.
import { apiClient } from '../auth/AuthContext';
import type { CursorPage } from './applications';

export type ReviewStatus = 'VISIBLE' | 'HIDDEN';

export type ReviewSummary = {
  id: string;
  orderId: string;
  sellerId: string;
  buyerUserId: string;
  rating: number;
  body: string | null;
  status: ReviewStatus;
  sellerResponseBody: string | null;
  sellerRespondedAt: string | null;
  hiddenReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export function listReviews(params: { status?: ReviewStatus; sellerId?: string; cursor?: string }): Promise<CursorPage<ReviewSummary>> {
  return apiClient.request('/admin/reviews', {
    query: { status: params.status, sellerId: params.sellerId, cursor: params.cursor, limit: 25 },
  });
}

export function hideReview(reviewId: string, reason: string): Promise<ReviewSummary> {
  return apiClient.request(`/admin/reviews/${reviewId}/hide`, { method: 'POST', body: { reason } });
}

export function unhideReview(reviewId: string): Promise<ReviewSummary> {
  return apiClient.request(`/admin/reviews/${reviewId}/unhide`, { method: 'POST' });
}
