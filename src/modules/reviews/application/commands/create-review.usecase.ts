import { Inject, Injectable } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { OrdersService } from '../../../orders/application/orders.service';
import { OrderNotFoundError } from '../../../orders/domain/errors/orders.errors';
import { REVIEW_REPOSITORY, ReviewRepositoryPort } from '../../domain/ports/review.repository.port';
import { Review } from '../../domain/entities/review.entity';
import { OrderNotReviewableError, ReviewAlreadyExistsError } from '../../domain/errors/reviews.errors';

const REVIEWABLE_STATUSES = ['DELIVERED', 'COMPLETED'] as const;

export interface CreateReviewCommand {
  readonly orderId: string;
  readonly buyerUserId: string;
  readonly rating: number;
  readonly body: string | null;
}

// POST /v1/orders/:id/review — not in 05-API-SPEC.md (no review model exists there at all,
// confirmed in Phase 8 scoping). One review per order, buyer-owned, only once the order has
// actually arrived (DELIVERED or COMPLETED) — ties the review to a verified purchase rather than
// a free-floating seller rating. Ownership and existence are resolved through OrdersService, not
// a direct repository call, per this project's "cross-module calls go through application
// services only" rule.
@Injectable()
export class CreateReviewUseCase {
  constructor(
    private readonly orders: OrdersService,
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepositoryPort,
  ) {}

  async execute(
    cmd: CreateReviewCommand,
  ): Promise<Result<Review, OrderNotFoundError | OrderNotReviewableError | ReviewAlreadyExistsError>> {
    const orderResult = await this.orders.getMyOrder({ userId: cmd.buyerUserId, orderId: cmd.orderId });
    if (!orderResult.ok) {
      return orderResult;
    }
    const order = orderResult.value;

    if (!REVIEWABLE_STATUSES.includes(order.status as (typeof REVIEWABLE_STATUSES)[number])) {
      return Err(new OrderNotReviewableError(order.id, order.status));
    }

    const existing = await this.reviews.findByOrderId(order.id);
    if (existing) {
      return Err(new ReviewAlreadyExistsError(order.id));
    }

    const review = await this.reviews.create({
      id: generateId(),
      orderId: order.id,
      sellerId: order.sellerId,
      buyerUserId: cmd.buyerUserId,
      rating: cmd.rating,
      body: cmd.body,
    });
    return Ok(review);
  }
}
