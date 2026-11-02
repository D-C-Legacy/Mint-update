import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { REVIEW_REPOSITORY, ReviewRepositoryPort } from '../../domain/ports/review.repository.port';
import { ReviewNotFoundError } from '../../domain/errors/reviews.errors';

export interface DeleteReviewCommand {
  readonly reviewId: string;
  readonly buyerUserId: string;
}

@Injectable()
export class DeleteReviewUseCase {
  constructor(@Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepositoryPort) {}

  async execute(cmd: DeleteReviewCommand): Promise<Result<true, ReviewNotFoundError>> {
    const deleted = await this.reviews.delete(cmd.reviewId, cmd.buyerUserId);
    if (!deleted) {
      return Err(new ReviewNotFoundError(cmd.reviewId));
    }
    return Ok(true);
  }
}
