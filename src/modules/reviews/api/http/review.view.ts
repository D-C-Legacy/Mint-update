import { Review } from '../../domain/entities/review.entity';

export function toReviewView(review: Review): Record<string, unknown> {
  return {
    id: review.id,
    orderId: review.orderId,
    sellerId: review.sellerId,
    buyerUserId: review.buyerUserId,
    rating: review.rating,
    body: review.body,
    status: review.status,
    sellerResponseBody: review.sellerResponseBody,
    sellerRespondedAt: review.sellerRespondedAt?.toISOString() ?? null,
    hiddenReason: review.status === 'HIDDEN' ? review.hiddenReason : null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}
