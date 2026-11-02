import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { REVIEW_REPOSITORY, ReviewRepositoryPort } from '../../domain/ports/review.repository.port';
import { Review } from '../../domain/entities/review.entity';
import { ReviewNotFoundError } from '../../domain/errors/reviews.errors';

export interface UpdateReviewCommand {
  readonly reviewId: string;
  readonly buyerUserId: string;
  readonly rating: number;
  readonly body: string | null;
}

// PATCH /v1/reviews/:id — buyer edits their own review, any time (no edit window in the docs to
// enforce, so none was invented). A seller's response is untouched by this call.
@Injectable()
export class UpdateReviewUseCase {
  constructor(@Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepositoryPort) {}

  async execute(cmd: UpdateReviewCommand): Promise<Result<Review, ReviewNotFoundError>> {
    const existing = await this.reviews.findById(cmd.reviewId);
    if (!existing || existing.buyerUserId !== cmd.buyerUserId) {
      // 404, not 403 — masks someone else's review the same way every other ownership check in
      // this codebase does (OrdersController, addresses, notifications).
      return Err(new ReviewNotFoundError(cmd.reviewId));
    }
    const updated = await this.reviews.update(cmd.reviewId, { rating: cmd.rating, body: cmd.body });
    if (!updated) {
      return Err(new ReviewNotFoundError(cmd.reviewId));
    }
    return Ok(updated);
  }
}
