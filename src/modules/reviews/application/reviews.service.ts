import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../shared/result/result';
import { CursorPage } from '../../../shared/pagination/cursor';
import { CreateReviewUseCase, CreateReviewCommand } from './commands/create-review.usecase';
import { UpdateReviewUseCase, UpdateReviewCommand } from './commands/update-review.usecase';
import { DeleteReviewUseCase, DeleteReviewCommand } from './commands/delete-review.usecase';
import { RespondToReviewUseCase, RespondToReviewCommand } from './commands/respond-to-review.usecase';
import { ListSellerReviewsQuery, ListSellerReviewsCommand } from './queries/list-seller-reviews.query';
import { GetMyReviewForOrderQuery, GetMyReviewForOrderCommand } from './queries/get-my-review-for-order.query';
import { ListReviewsForAdminQuery, ListReviewsForAdminCommand } from './queries/list-reviews-for-admin.query';
import { Review, ReviewStatus } from '../domain/entities/review.entity';
import { REVIEW_REPOSITORY, ReviewRepositoryPort, SellerRatingSummary } from '../domain/ports/review.repository.port';
import { ReviewNotFoundError, ReviewAlreadyExistsError, OrderNotReviewableError } from '../domain/errors/reviews.errors';
import { OrderNotFoundError } from '../../orders/domain/errors/orders.errors';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly createReviewUseCase: CreateReviewUseCase,
    private readonly updateReviewUseCase: UpdateReviewUseCase,
    private readonly deleteReviewUseCase: DeleteReviewUseCase,
    private readonly respondToReviewUseCase: RespondToReviewUseCase,
    private readonly listSellerReviewsQuery: ListSellerReviewsQuery,
    private readonly getMyReviewForOrderQuery: GetMyReviewForOrderQuery,
    private readonly listReviewsForAdminQuery: ListReviewsForAdminQuery,
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepositoryPort,
  ) {}

  async create(
    cmd: CreateReviewCommand,
  ): Promise<Result<Review, OrderNotFoundError | OrderNotReviewableError | ReviewAlreadyExistsError>> {
    return this.createReviewUseCase.execute(cmd);
  }

  async update(cmd: UpdateReviewCommand): Promise<Result<Review, ReviewNotFoundError>> {
    return this.updateReviewUseCase.execute(cmd);
  }

  async delete(cmd: DeleteReviewCommand): Promise<Result<true, ReviewNotFoundError>> {
    return this.deleteReviewUseCase.execute(cmd);
  }

  async respond(cmd: RespondToReviewCommand): Promise<Result<Review, ReviewNotFoundError>> {
    return this.respondToReviewUseCase.execute(cmd);
  }

  async listForSeller(cmd: ListSellerReviewsCommand): Promise<{ page: CursorPage<Review>; summary: SellerRatingSummary }> {
    return this.listSellerReviewsQuery.execute(cmd);
  }

  async getMyReviewForOrder(cmd: GetMyReviewForOrderCommand): Promise<Review | null> {
    return this.getMyReviewForOrderQuery.execute(cmd);
  }

  // --- Admin moderation (called from AdminController, same cross-module shape as
  // ChatService.deleteMessage/SellersService.suspendSeller) ---

  async adminList(cmd: ListReviewsForAdminCommand): Promise<CursorPage<Review>> {
    return this.listReviewsForAdminQuery.execute(cmd);
  }

  async adminSetVisibility(
    reviewId: string,
    status: ReviewStatus,
    hiddenByUserId: string | null,
    reason: string | null,
  ): Promise<Result<Review, ReviewNotFoundError>> {
    const updated = await this.reviews.setVisibility(reviewId, status, hiddenByUserId, reason);
    if (!updated) {
      return Err(new ReviewNotFoundError(reviewId));
    }
    return Ok(updated);
  }

  // Thin lookup for ReportsService's admin preview enrichment — deliberately not exported as a
  // full query class, this exists only because the report queue needs to show what's being
  // reported without a second admin screen.
  async adminFindById(reviewId: string): Promise<Review | null> {
    return this.reviews.findById(reviewId);
  }
}
