import { Inject, Injectable } from '@nestjs/common';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { REVIEW_REPOSITORY, ReviewRepositoryPort } from '../../domain/ports/review.repository.port';
import { Review, ReviewStatus } from '../../domain/entities/review.entity';

export interface ListReviewsForAdminCommand {
  readonly status: ReviewStatus | undefined;
  readonly sellerId: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// GET /admin/reviews — moderation queue, every status.
@Injectable()
export class ListReviewsForAdminQuery {
  constructor(@Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepositoryPort) {}

  async execute(cmd: ListReviewsForAdminCommand): Promise<CursorPage<Review>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.reviews.listForAdmin({
      status: cmd.status,
      sellerId: cmd.sellerId,
      cursor: cmd.cursor,
      limit,
    });
    return buildCursorPage(rows, limit);
  }
}
