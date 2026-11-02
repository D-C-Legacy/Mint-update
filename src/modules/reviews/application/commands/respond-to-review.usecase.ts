import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SellersService } from '../../../sellers/application/sellers.service';
import { REVIEW_REPOSITORY, ReviewRepositoryPort } from '../../domain/ports/review.repository.port';
import { Review } from '../../domain/entities/review.entity';
import { ReviewNotFoundError } from '../../domain/errors/reviews.errors';

export interface RespondToReviewCommand {
  readonly reviewId: string;
  readonly sellerUserId: string;
  readonly body: string;
}

// POST /v1/reviews/:id/respond — the seller's one public reply to a review of them. Resolves the
// caller's own sellerId through SellersService (same pattern LedgerService/PayoutsService use),
// then the repository's own `WHERE id AND sellerId` guard masks someone else's review as 404.
@Injectable()
export class RespondToReviewUseCase {
  constructor(
    private readonly sellers: SellersService,
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepositoryPort,
  ) {}

  async execute(cmd: RespondToReviewCommand): Promise<Result<Review, ReviewNotFoundError>> {
    const sellerResult = await this.sellers.getMySeller({ userId: cmd.sellerUserId });
    if (!sellerResult.ok) {
      return Err(new ReviewNotFoundError(cmd.reviewId));
    }
    const updated = await this.reviews.respond(cmd.reviewId, sellerResult.value.seller.id, cmd.body);
    if (!updated) {
      return Err(new ReviewNotFoundError(cmd.reviewId));
    }
    return Ok(updated);
  }
}
