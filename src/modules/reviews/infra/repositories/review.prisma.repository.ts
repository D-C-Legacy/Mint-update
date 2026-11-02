import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateReviewInput,
  ListForAdminFilter,
  ListForSellerFilter,
  ReviewRepositoryPort,
  SellerRatingSummary,
  UpdateReviewInput,
} from '../../domain/ports/review.repository.port';
import { Review, ReviewStatus } from '../../domain/entities/review.entity';
import { toDomainReview } from '../mappers/review.mapper';

@Injectable()
export class ReviewPrismaRepository implements ReviewRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateReviewInput): Promise<Review> {
    const row = await this.prisma.review.create({
      data: {
        id: input.id,
        orderId: input.orderId,
        sellerId: input.sellerId,
        buyerUserId: input.buyerUserId,
        rating: input.rating,
        body: input.body,
      },
    });
    return toDomainReview(row);
  }

  async findById(id: string): Promise<Review | null> {
    const row = await this.prisma.review.findUnique({ where: { id } });
    return row ? toDomainReview(row) : null;
  }

  async findByOrderId(orderId: string): Promise<Review | null> {
    const row = await this.prisma.review.findUnique({ where: { orderId } });
    return row ? toDomainReview(row) : null;
  }

  async update(id: string, input: UpdateReviewInput): Promise<Review | null> {
    const row = await this.prisma.review.findUnique({ where: { id } });
    if (!row) return null;
    const updated = await this.prisma.review.update({
      where: { id },
      data: { rating: input.rating, body: input.body },
    });
    return toDomainReview(updated);
  }

  async delete(id: string, buyerUserId: string): Promise<boolean> {
    const { count } = await this.prisma.review.deleteMany({ where: { id, buyerUserId } });
    return count > 0;
  }

  async respond(id: string, sellerId: string, body: string): Promise<Review | null> {
    const { count } = await this.prisma.review.updateMany({
      where: { id, sellerId },
      data: { sellerResponseBody: body, sellerRespondedAt: new Date() },
    });
    if (count === 0) return null;
    return this.findById(id);
  }

  async setVisibility(
    id: string,
    status: ReviewStatus,
    hiddenByUserId: string | null,
    reason: string | null,
  ): Promise<Review | null> {
    const { count } = await this.prisma.review.updateMany({
      where: { id },
      data: {
        status,
        hiddenByUserId: status === 'HIDDEN' ? hiddenByUserId : null,
        hiddenAt: status === 'HIDDEN' ? new Date() : null,
        hiddenReason: status === 'HIDDEN' ? reason : null,
      },
    });
    if (count === 0) return null;
    return this.findById(id);
  }

  async listForSeller(filter: ListForSellerFilter): Promise<Review[]> {
    const rows = await this.prisma.review.findMany({
      where: { sellerId: filter.sellerId, status: 'VISIBLE' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainReview);
  }

  async getRatingSummary(sellerId: string): Promise<SellerRatingSummary> {
    const agg = await this.prisma.review.aggregate({
      where: { sellerId, status: 'VISIBLE' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return {
      sellerId,
      averageRating: agg._avg.rating ?? 0,
      reviewCount: agg._count._all,
    };
  }

  async listForAdmin(filter: ListForAdminFilter): Promise<Review[]> {
    const rows = await this.prisma.review.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.sellerId ? { sellerId: filter.sellerId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainReview);
  }
}
