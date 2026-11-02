import { Review as PrismaReview } from '@prisma/client';
import { Review } from '../../domain/entities/review.entity';

export function toDomainReview(row: PrismaReview): Review {
  return {
    id: row.id,
    orderId: row.orderId,
    sellerId: row.sellerId,
    buyerUserId: row.buyerUserId,
    rating: row.rating,
    body: row.body,
    status: row.status,
    sellerResponseBody: row.sellerResponseBody,
    sellerRespondedAt: row.sellerRespondedAt,
    hiddenByUserId: row.hiddenByUserId,
    hiddenAt: row.hiddenAt,
    hiddenReason: row.hiddenReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
