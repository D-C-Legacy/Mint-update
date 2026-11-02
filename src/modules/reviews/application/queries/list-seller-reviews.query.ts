import { Inject, Injectable } from '@nestjs/common';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { REVIEW_REPOSITORY, ReviewRepositoryPort, SellerRatingSummary } from '../../domain/ports/review.repository.port';
import { Review } from '../../domain/entities/review.entity';

export interface ListSellerReviewsCommand {
  readonly sellerId: string;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// GET /v1/sellers/:sellerId/reviews — fully public (same "no guard" precedent as
// CatalogController.getCategories()), VISIBLE only.
@Injectable()
export class ListSellerReviewsQuery {
  constructor(@Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepositoryPort) {}

  async execute(cmd: ListSellerReviewsCommand): Promise<{ page: CursorPage<Review>; summary: SellerRatingSummary }> {
    const limit = normalizeLimit(cmd.limit);
    const [rows, summary] = await Promise.all([
      this.reviews.listForSeller({ sellerId: cmd.sellerId, cursor: cmd.cursor, limit }),
      this.reviews.getRatingSummary(cmd.sellerId),
    ]);
    return { page: buildCursorPage(rows, limit), summary };
  }
}
