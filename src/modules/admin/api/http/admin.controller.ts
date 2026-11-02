import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  HttpCode,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SellersService } from '../../../sellers/application/sellers.service';
import { ChatService } from '../../../chat/application/chat.service';
import { ReviewsService } from '../../../reviews/application/reviews.service';
import { MessagingService } from '../../../messaging/application/messaging.service';
import { HelpService } from '../../../help/application/help.service';
import { ReportsService } from '../../../reports/application/reports.service';
import { AdminService } from '../../application/admin.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { RolesGuard } from '../../../../platform/auth/roles.guard';
import { Roles } from '../../../../platform/auth/roles.decorator';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { IdempotencyGuard } from '../../../../platform/idempotency/idempotency.interceptor';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { RejectReasonSchema, RejectReasonDto } from './dto/reject-reason.dto';
import {
  ListApplicationsQuerySchema,
  ListApplicationsQueryDto,
} from './dto/list-applications-query.dto';
import { UpdateCommissionSchema, UpdateCommissionDto } from './dto/update-commission.dto';
import { ListOrdersQuerySchema, ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { RefundOrderSchema, RefundOrderDto } from './dto/refund-order.dto';
import {
  ListPayoutRunsQuerySchema,
  ListPayoutRunsQueryDto,
} from './dto/list-payout-runs-query.dto';
import { ListAuditLogQuerySchema, ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';
import { ListPayoutsQuerySchema, ListPayoutsQueryDto } from './dto/list-payouts-query.dto';
import {
  AnalyticsRangeQuerySchema,
  AnalyticsRangeQueryDto,
} from '../../../../shared/analytics/analytics-range-query.dto';
import {
  ListAdminReviewsQuerySchema,
  ListAdminReviewsQueryDto,
} from '../../../reviews/api/http/dto/list-admin-reviews-query.dto';
import { HideReviewSchema, HideReviewDto } from '../../../reviews/api/http/dto/hide-review.dto';
import { toReviewView } from '../../../reviews/api/http/review.view';
import {
  CreateHelpArticleSchema,
  CreateHelpArticleDto,
} from '../../../help/api/http/dto/create-help-article.dto';
import {
  UpdateHelpArticleSchema,
  UpdateHelpArticleDto,
} from '../../../help/api/http/dto/update-help-article.dto';
import { toHelpArticleView } from '../../../help/api/http/help-article.view';
import { ListReportsQuerySchema, ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ListUsersQuerySchema, ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserNotFoundError } from '../../domain/errors/admin.errors';
import {
  ResolveReportSchema,
  ResolveReportDto,
} from '../../../reports/api/http/dto/resolve-report.dto';
import { toReportView } from '../../../reports/api/http/report.view';

@Controller('admin')
@UseGuards(JwtGuard, RolesGuard, DefaultRateLimitGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly sellers: SellersService,
    private readonly chat: ChatService,
    private readonly reviews: ReviewsService,
    private readonly messaging: MessagingService,
    private readonly help: HelpService,
    private readonly reportsSvc: ReportsService,
    private readonly admin: AdminService,
  ) {}

  @Get('seller-applications')
  async listApplications(
    @Query(new ZodValidationPipe(ListApplicationsQuerySchema)) query: ListApplicationsQueryDto,
  ): Promise<{ data: unknown }> {
    const result = await this.sellers.listApplications({
      decision: query.decision,
      cursor: query.cursor,
      limit: query.limit,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Get('seller-applications/:id')
  async getApplicationDetail(@Param('id') applicationId: string): Promise<{ data: unknown }> {
    const result = await this.sellers.getApplicationDetail({ applicationId });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Get('documents/:id/url')
  async getDocumentUrl(
    @Param('id') documentId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.sellers.getDocumentDownloadUrl({ documentId });
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'seller_document.viewed',
      targetType: 'SellerDocument',
      targetId: documentId,
      ipAddress: req.ip,
    });

    return { data: result.value };
  }

  @Post('seller-applications/:id/approve')
  @HttpCode(200)
  async approve(
    @Param('id') applicationId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.sellers.approveApplication({
      applicationId,
      reviewedByUserId: admin.id,
    });
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'seller.approved',
      targetType: 'SellerApplication',
      targetId: applicationId,
      after: { status: result.value.status },
      ipAddress: req.ip,
    });

    return { data: result.value };
  }

  @Post('seller-applications/:id/reject')
  @HttpCode(200)
  async reject(
    @Param('id') applicationId: string,
    @Body(new ZodValidationPipe(RejectReasonSchema)) dto: RejectReasonDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.sellers.rejectApplication({
      applicationId,
      reviewedByUserId: admin.id,
      reason: dto.reason,
    });
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'seller.rejected',
      targetType: 'SellerApplication',
      targetId: applicationId,
      after: { status: result.value.status },
      reason: dto.reason,
      ipAddress: req.ip,
    });

    return { data: result.value };
  }

  @Post('sellers/:id/suspend')
  @HttpCode(200)
  async suspend(
    @Param('id') sellerId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.sellers.suspendSeller({ sellerId });
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'seller.suspended',
      targetType: 'Seller',
      targetId: sellerId,
      after: { status: result.value.status },
      ipAddress: req.ip,
    });

    return { data: result.value };
  }

  @Post('sellers/:id/reinstate')
  @HttpCode(200)
  async reinstate(
    @Param('id') sellerId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.sellers.reinstateSeller({ sellerId });
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'seller.reinstated',
      targetType: 'Seller',
      targetId: sellerId,
      after: { status: result.value.status },
      ipAddress: req.ip,
    });

    return { data: result.value };
  }

  @Post('chat/messages/:id/delete')
  @HttpCode(200)
  async deleteChatMessage(
    @Param('id') messageId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.chat.deleteMessage({ messageId, deletedByUserId: admin.id });
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'chat_message.deleted',
      targetType: 'ChatMessage',
      targetId: messageId,
      ipAddress: req.ip,
    });

    return { data: result.value };
  }

  @Patch('sellers/:id/commission')
  async updateCommission(
    @Param('id') sellerId: string,
    @Body(new ZodValidationPipe(UpdateCommissionSchema)) dto: UpdateCommissionDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.admin.updateCommission({
      sellerId,
      commissionBps: dto.commissionBps,
    });
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'seller.commission_updated',
      targetType: 'Seller',
      targetId: sellerId,
      after: { commissionBps: dto.commissionBps },
      ipAddress: req.ip,
    });

    return { data: result.value };
  }

  @Get('orders')
  async listOrders(
    @Query(new ZodValidationPipe(ListOrdersQuerySchema)) query: ListOrdersQueryDto,
  ): Promise<{ data: unknown }> {
    const result = await this.admin.listOrders({
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
    return { data: result };
  }

  @Get('orders/:id')
  async getOrder(@Param('id') orderId: string): Promise<{ data: unknown }> {
    const result = await this.admin.getOrder({ orderId });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  // Idempotency-Key required here (and on triggerPayoutRun below) — both are real money
  // movement (a Stripe refund, a batch of seller transfers) with no other per-request dedupe:
  // RefundPaymentUseCase only checks the running total against `remaining`, so two identical
  // accidental double-clicks requesting an amount under that remaining balance would both
  // succeed and genuinely over-refund. Every other admin POST in this controller (suspend,
  // reinstate, hold, kill, force-deliver, chat delete, approve/reject) is a status transition,
  // not a money movement, and is already atomically guarded by its own `WHERE status = X` check
  // — a retried duplicate call there just hits a clean 409, no double financial effect, so P9-02
  // deliberately does not add this guard to them. See PROGRESS.md/MEMORY.md for the full scope
  // reasoning (same "map the real surface, flag the scope decision" discipline P9-01 used).
  @Post('orders/:id/refund')
  @HttpCode(200)
  @UseInterceptors(IdempotencyGuard)
  async refundOrder(
    @Param('id') orderId: string,
    @Body(new ZodValidationPipe(RefundOrderSchema)) dto: RefundOrderDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.admin.refundOrder({
      orderId,
      initiatedByUserId: admin.id,
      amount: dto.amount,
      reason: dto.reason,
    });
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'order.refunded',
      targetType: 'Order',
      targetId: orderId,
      after: { amount: dto.amount.toString() },
      reason: dto.reason,
      ipAddress: req.ip,
    });

    return { data: result.value };
  }

  @Post('orders/:id/force-deliver')
  @HttpCode(200)
  async forceDeliverOrder(
    @Param('id') orderId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.admin.forceDeliver({ orderId });
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'order.force_delivered',
      targetType: 'Order',
      targetId: orderId,
      after: { status: result.value.status },
      ipAddress: req.ip,
    });

    return { data: result.value };
  }

  @Get('payout-runs')
  async listPayoutRuns(
    @Query(new ZodValidationPipe(ListPayoutRunsQuerySchema)) query: ListPayoutRunsQueryDto,
  ): Promise<{ data: unknown }> {
    const result = await this.admin.listPayoutRuns({ cursor: query.cursor, limit: query.limit });
    return { data: result };
  }

  @Post('payout-runs')
  @HttpCode(200)
  @UseInterceptors(IdempotencyGuard)
  async triggerPayoutRun(
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.admin.triggerPayoutRun();

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'payout_run.triggered',
      targetType: 'PayoutRun',
      targetId: result.run.id,
      after: { payoutsCreated: result.payoutsCreated },
      ipAddress: req.ip,
    });

    return { data: result };
  }

  @Get('payouts')
  async listPayouts(
    @Query(new ZodValidationPipe(ListPayoutsQuerySchema)) query: ListPayoutsQueryDto,
  ): Promise<{ data: unknown }> {
    const result = await this.admin.listPayouts({
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
    return { data: result };
  }

  @Post('payouts/:id/hold')
  @HttpCode(200)
  async holdPayout(
    @Param('id') payoutId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.admin.holdPayout({ payoutId });
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'payout.held',
      targetType: 'Payout',
      targetId: payoutId,
      ipAddress: req.ip,
    });

    return { data: result.value };
  }

  @Get('ledger/reconciliation')
  async getReconciliationReport(): Promise<{ data: unknown }> {
    const report = await this.admin.getReconciliationReport();
    return { data: report };
  }

  @Post('streams/:id/kill')
  @HttpCode(200)
  async killStream(
    @Param('id') sessionId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.admin.killStream({ sessionId });
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'stream.killed',
      targetType: 'StreamSession',
      targetId: sessionId,
      ipAddress: req.ip,
    });

    return { data: result.value };
  }

  @Get('audit-log')
  async listAuditLog(
    @Query(new ZodValidationPipe(ListAuditLogQuerySchema)) query: ListAuditLogQueryDto,
  ): Promise<{ data: unknown }> {
    const result = await this.admin.listAuditLog({
      actorUserId: query.actorUserId,
      targetType: query.targetType,
      cursor: query.cursor,
      limit: query.limit,
    });
    return { data: result };
  }

  @Get('analytics/orders-summary')
  async getOrdersSummary(
    @Query(new ZodValidationPipe(AnalyticsRangeQuerySchema)) query: AnalyticsRangeQueryDto,
  ): Promise<{ data: unknown }> {
    const result = await this.admin.getOrdersSummary({ from: query.from, to: query.to });
    return { data: result };
  }

  @Get('analytics/orders-by-status')
  async getOrdersByStatus(): Promise<{ data: unknown }> {
    const result = await this.admin.getOrdersByStatus();
    return { data: result };
  }

  @Get('analytics/sellers-summary')
  async getSellersSummary(
    @Query(new ZodValidationPipe(AnalyticsRangeQuerySchema)) query: AnalyticsRangeQueryDto,
  ): Promise<{ data: unknown }> {
    const result = await this.admin.getSellersSummary({ from: query.from, to: query.to });
    return { data: result };
  }

  @Get('analytics/payouts-summary')
  async getPayoutsSummary(): Promise<{ data: unknown }> {
    const result = await this.admin.getPayoutsSummary();
    return { data: result };
  }

  // --- Phase 8: reviews, messages, help — not in 05-API-SPEC.md, added on the user's instruction
  // once the founder-scope gap was confirmed. Mirrors the existing seller/chat moderation shape
  // exactly (service injected directly into this controller, audit-logged the same way). ---

  @Get('reviews')
  async listReviews(
    @Query(new ZodValidationPipe(ListAdminReviewsQuerySchema)) query: ListAdminReviewsQueryDto,
  ): Promise<{ data: unknown }> {
    const page = await this.reviews.adminList({
      status: query.status,
      sellerId: query.sellerId,
      cursor: query.cursor,
      limit: query.limit,
    });
    return { data: { items: page.items.map(toReviewView), nextCursor: page.nextCursor } };
  }

  @Post('reviews/:id/hide')
  @HttpCode(200)
  async hideReview(
    @Param('id') reviewId: string,
    @Body(new ZodValidationPipe(HideReviewSchema)) dto: HideReviewDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.reviews.adminSetVisibility(reviewId, 'HIDDEN', admin.id, dto.reason);
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'review.hidden',
      targetType: 'Review',
      targetId: reviewId,
      reason: dto.reason,
      ipAddress: req.ip,
    });

    return { data: toReviewView(result.value) };
  }

  @Post('reviews/:id/unhide')
  @HttpCode(200)
  async unhideReview(
    @Param('id') reviewId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.reviews.adminSetVisibility(reviewId, 'VISIBLE', null, null);
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'review.unhidden',
      targetType: 'Review',
      targetId: reviewId,
      ipAddress: req.ip,
    });

    return { data: toReviewView(result.value) };
  }

  // Mirrors the existing chat/messages/:id/delete precedent exactly — a real hard delete, not a
  // hide, since a harmful DM shouldn't stay visible to its recipient either.
  @Post('messages/:id/delete')
  @HttpCode(200)
  async deleteMessage(
    @Param('id') messageId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.messaging.adminDeleteMessage(messageId);
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'message.deleted',
      targetType: 'Message',
      targetId: messageId,
      ipAddress: req.ip,
    });

    return { data: result.value };
  }

  @Get('help/articles')
  async listHelpArticles(): Promise<{ data: unknown }> {
    const articles = await this.help.adminListAll();
    return { data: { items: articles.map(toHelpArticleView) } };
  }

  @Post('help/articles')
  async createHelpArticle(
    @Body(new ZodValidationPipe(CreateHelpArticleSchema)) dto: CreateHelpArticleDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const article = await this.help.adminCreate(dto);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'help_article.created',
      targetType: 'HelpArticle',
      targetId: article.id,
      ipAddress: req.ip,
    });

    return { data: toHelpArticleView(article) };
  }

  @Patch('help/articles/:id')
  async updateHelpArticle(
    @Param('id') articleId: string,
    @Body(new ZodValidationPipe(UpdateHelpArticleSchema)) dto: UpdateHelpArticleDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.help.adminUpdate(articleId, {
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.body !== undefined ? { body: dto.body } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
    });
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'help_article.updated',
      targetType: 'HelpArticle',
      targetId: articleId,
      after: dto,
      ipAddress: req.ip,
    });

    return { data: toHelpArticleView(result.value) };
  }

  @Post('help/articles/:id/delete')
  @HttpCode(200)
  async deleteHelpArticle(
    @Param('id') articleId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.help.adminDelete(articleId);
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'help_article.deleted',
      targetType: 'HelpArticle',
      targetId: articleId,
      ipAddress: req.ip,
    });

    return { data: { deleted: true } };
  }

  // Each report is enriched with a preview of its target here, not inside ReportsService — this
  // avoids ReportsModule importing ReviewsModule/MessagingModule back (would create a circular DI
  // graph, since both of those create reports through this same controller's sibling routes).
  @Get('reports')
  async listReports(
    @Query(new ZodValidationPipe(ListReportsQuerySchema)) query: ListReportsQueryDto,
  ): Promise<{ data: unknown }> {
    const page = await this.reportsSvc.listForAdmin({
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
    const items = await Promise.all(
      page.items.map(async (report) => {
        if (report.targetType === 'REVIEW') {
          const review = await this.reviews.adminFindById(report.targetId);
          return toReportView(report, review ? toReviewView(review) : null);
        }
        const message = await this.messaging.adminFindMessageById(report.targetId);
        return toReportView(
          report,
          message ? { id: message.id, body: message.body, mine: false } : null,
        );
      }),
    );
    return { data: { items, nextCursor: page.nextCursor } };
  }

  @Post('reports/:id/resolve')
  @HttpCode(200)
  async resolveReport(
    @Param('id') reportId: string,
    @Body(new ZodValidationPipe(ResolveReportSchema)) dto: ResolveReportDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.reportsSvc.resolve({
      reportId,
      resolvedByUserId: admin.id,
      status: dto.status,
      note: dto.note ?? null,
    });
    if (!result.ok) throw toHttpException(result.error);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'report.resolved',
      targetType: 'Report',
      targetId: reportId,
      after: { status: dto.status },
      ...(dto.note !== undefined ? { reason: dto.note } : {}),
      ipAddress: req.ip,
    });

    return { data: toReportView(result.value, null) };
  }

  // User management (Phase C)
  @Get('users')
  async listUsers(
    @Query(new ZodValidationPipe(ListUsersQuerySchema)) query: ListUsersQueryDto,
  ): Promise<{ data: unknown }> {
    const page = await this.admin.listUsers({
      q: query.q,
      status: query.status,
      platform: query.platform,
      role: query.role,
      hasSupportTickets: query.hasSupportTickets,
      supportCategory: query.supportCategory,
      cursor: query.cursor,
      limit: query.limit,
    });
    return { data: { items: page.items, nextCursor: page.nextCursor } };
  }

  @Get('users/:id')
  async getUser(@Param('id') userId: string): Promise<{ data: unknown }> {
    const user = await this.admin.getUserDetail(userId);
    if (!user) throw toHttpException(new UserNotFoundError(userId));
    return { data: user };
  }

  @Post('users/:id/suspend')
  @HttpCode(200)
  async suspendUser(
    @Param('id') userId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.admin.suspendUser(userId);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'user.suspended',
      targetType: 'User',
      targetId: userId,
      after: { status: result.status },
      ipAddress: req.ip,
    });

    return { data: result };
  }

  @Post('users/:id/reinstate')
  @HttpCode(200)
  async reinstateUser(
    @Param('id') userId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ): Promise<{ data: unknown }> {
    const result = await this.admin.reinstateUser(userId);

    await this.admin.recordAuditLog({
      actorUserId: admin.id,
      action: 'user.reinstated',
      targetType: 'User',
      targetId: userId,
      after: { status: result.status },
      ipAddress: req.ip,
    });

    return { data: result };
  }
}
