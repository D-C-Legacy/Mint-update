import { api } from "./index";
import type { Page } from "./catalog";

// Not in 05-API-SPEC.md — no review model exists in the docs at all (Phase 8). One review per
// order, buyer-owned, only once the order is DELIVERED/COMPLETED.
export type ReviewView = {
  id: string;
  orderId: string;
  sellerId: string;
  buyerUserId: string;
  rating: number;
  body: string | null;
  status: "VISIBLE" | "HIDDEN";
  sellerResponseBody: string | null;
  sellerRespondedAt: string | null;
  hiddenReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SellerReviewsPage = Page<ReviewView> & {
  summary: { averageRating: number; reviewCount: number };
};

// GET /v1/sellers/:sellerId/reviews — fully public, no token needed.
export function listSellerReviews(sellerId: string, cursor?: string): Promise<SellerReviewsPage> {
  return api.request<SellerReviewsPage>(`/sellers/${encodeURIComponent(sellerId)}/reviews`, {
    query: { limit: 20, cursor },
    auth: false,
  });
}

export function getMyReviewForOrder(orderId: string): Promise<ReviewView | null> {
  return api.request<ReviewView | null>(`/orders/${encodeURIComponent(orderId)}/review`);
}

export function createReview(orderId: string, rating: number, body?: string): Promise<ReviewView> {
  return api.request<ReviewView>(`/orders/${encodeURIComponent(orderId)}/review`, {
    method: "POST",
    body: { rating, ...(body ? { body } : {}) },
  });
}

export function updateReview(reviewId: string, rating: number, body?: string): Promise<ReviewView> {
  return api.request<ReviewView>(`/reviews/${encodeURIComponent(reviewId)}`, {
    method: "PATCH",
    body: { rating, ...(body ? { body } : {}) },
  });
}

export function deleteReview(reviewId: string): Promise<unknown> {
  return api.request(`/reviews/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
}

// Seller's one public reply.
export function respondToReview(reviewId: string, body: string): Promise<ReviewView> {
  return api.request<ReviewView>(`/reviews/${encodeURIComponent(reviewId)}/respond`, {
    method: "POST",
    body: { body },
  });
}
