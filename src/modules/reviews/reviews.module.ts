import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { OrdersModule } from '../orders/orders.module';
import { SellersModule } from '../sellers/sellers.module';
import { REVIEW_REPOSITORY } from './domain/ports/review.repository.port';
import { ReviewPrismaRepository } from './infra/repositories/review.prisma.repository';
import { CreateReviewUseCase } from './application/commands/create-review.usecase';
import { UpdateReviewUseCase } from './application/commands/update-review.usecase';
import { DeleteReviewUseCase } from './application/commands/delete-review.usecase';
import { RespondToReviewUseCase } from './application/commands/respond-to-review.usecase';
import { ListSellerReviewsQuery } from './application/queries/list-seller-reviews.query';
import { GetMyReviewForOrderQuery } from './application/queries/get-my-review-for-order.query';
import { ListReviewsForAdminQuery } from './application/queries/list-reviews-for-admin.query';
import { ReviewsService } from './application/reviews.service';
import { ReviewsController } from './api/http/reviews.controller';

// New module for Phase 8 (reviews, messages, help) — not in AGENTS.md's §5 module list, added on
// the user's instruction once the founder-scope gap was confirmed to have no existing home.
@Module({
  imports: [DatabaseModule, AuthModule, RateLimitModule, OrdersModule, SellersModule],
  controllers: [ReviewsController],
  providers: [
    { provide: REVIEW_REPOSITORY, useClass: ReviewPrismaRepository },
    CreateReviewUseCase,
    UpdateReviewUseCase,
    DeleteReviewUseCase,
    RespondToReviewUseCase,
    ListSellerReviewsQuery,
    GetMyReviewForOrderQuery,
    ListReviewsForAdminQuery,
    ReviewsService,
  ],
  exports: [ReviewsService],
})
export class ReviewsModule {}
