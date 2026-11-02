import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from '../../application/reviews.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { CreateReviewSchema, CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewSchema, UpdateReviewDto } from './dto/update-review.dto';
import { RespondToReviewSchema, RespondToReviewDto } from './dto/respond-to-review.dto';
import { ListSellerReviewsQuerySchema, ListSellerReviewsQueryDto } from './dto/list-seller-reviews-query.dto';
import { toReviewView } from './review.view';

// Not in 05-API-SPEC.md — no review model/route exists in the docs at all (confirmed Phase 8
// scoping, 13 Oct 2026). User-directed addition, same precedent as change-password/preferences/
// addresses/notifications/order-cancel. Business rules live in the use cases; this file only
// maps request to command and result to HTTP.
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  // Fully public — same "no guard" precedent as GET /categories — so a product/seller page can
  // show reviews to a signed-out visitor.
  @Get('sellers/:sellerId/reviews')
  async listForSeller(
    @Param('sellerId') sellerId: string,
    @Query(new ZodValidationPipe(ListSellerReviewsQuerySchema)) query: ListSellerReviewsQueryDto,
  ): Promise<{ data: unknown }> {
    const { page, summary } = await this.reviews.listForSeller({
      sellerId,
      cursor: query.cursor,
      limit: query.limit,
    });
    return {
      data: {
        items: page.items.map(toReviewView),
        nextCursor: page.nextCursor,
        summary: { averageRating: summary.averageRating, reviewCount: summary.reviewCount },
      },
    };
  }

  @Get('orders/:id/review')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async getMyReviewForOrder(
    @Param('id') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const review = await this.reviews.getMyReviewForOrder({ orderId, buyerUserId: user.id });
    return { data: review ? toReviewView(review) : null };
  }

  @Post('orders/:id/review')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async create(
    @Param('id') orderId: string,
    @Body(new ZodValidationPipe(CreateReviewSchema)) dto: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.reviews.create({
      orderId,
      buyerUserId: user.id,
      rating: dto.rating,
      body: dto.body ?? null,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toReviewView(result.value) };
  }

  @Patch('reviews/:id')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async update(
    @Param('id') reviewId: string,
    @Body(new ZodValidationPipe(UpdateReviewSchema)) dto: UpdateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.reviews.update({
      reviewId,
      buyerUserId: user.id,
      rating: dto.rating,
      body: dto.body ?? null,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toReviewView(result.value) };
  }

  @Delete('reviews/:id')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async delete(@Param('id') reviewId: string, @CurrentUser() user: AuthenticatedUser): Promise<{ data: unknown }> {
    const result = await this.reviews.delete({ reviewId, buyerUserId: user.id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: { deleted: true } };
  }

  // Seller's one public reply. 05-API-SPEC.md has no concept of this at all.
  @Post('reviews/:id/respond')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async respond(
    @Param('id') reviewId: string,
    @Body(new ZodValidationPipe(RespondToReviewSchema)) dto: RespondToReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.reviews.respond({ reviewId, sellerUserId: user.id, body: dto.body });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toReviewView(result.value) };
  }
}
