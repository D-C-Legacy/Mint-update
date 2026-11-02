import { Inject, Injectable } from '@nestjs/common';
import { REVIEW_REPOSITORY, ReviewRepositoryPort } from '../../domain/ports/review.repository.port';
import { Review } from '../../domain/entities/review.entity';

export interface GetMyReviewForOrderCommand {
  readonly orderId: string;
  readonly buyerUserId: string;
}

@Injectable()
export class GetMyReviewForOrderQuery {
  constructor(@Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepositoryPort) {}

  async execute(cmd: GetMyReviewForOrderCommand): Promise<Review | null> {
    const review = await this.reviews.findByOrderId(cmd.orderId);
    if (!review || review.buyerUserId !== cmd.buyerUserId) {
      return null;
    }
    return review;
  }
}
