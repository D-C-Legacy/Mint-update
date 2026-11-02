import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StreamingService } from '../../application/streaming.service';
import { SalesService } from '../../../sales/application/sales.service';
import { StorageService } from '../../../../platform/storage/storage.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { appConfig } from '../../../../config/app.config';
import {
  ListLiveStreamsQuerySchema,
  ListLiveStreamsQueryDto,
} from './dto/list-live-streams-query.dto';
import { CreateStreamSchema, CreateStreamDto } from './dto/create-stream.dto';
import { AddQueueItemSchema, AddQueueItemDto } from './dto/add-queue-item.dto';
import { ReorderQueueItemsSchema, ReorderQueueItemsDto } from './dto/reorder-queue-items.dto';
import { FeatureQueueItemSchema, FeatureQueueItemDto } from './dto/feature-queue-item.dto';
import { ToggleAutoQueueSchema, ToggleAutoQueueDto } from './dto/toggle-auto-queue.dto';
import { toPublicStreamSessionView } from './stream-session.view';
import { z } from 'zod';
import {
  AddModeratorSchema,
  AddModeratorDto,
  TimeoutUserSchema,
  TimeoutUserDto,
  ListModeratorsQuerySchema,
  ListModeratorsQueryDto,
  ListTimeoutsQuerySchema,
  ListTimeoutsQueryDto,
} from './dto/stream-moderation.dto';

const ListSessionPurchasesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
type ListSessionPurchasesQueryDto = z.infer<typeof ListSessionPurchasesQuerySchema>;

// Public read routes, no guard: same as GET /categories and GET /channels/:slug. Nothing in the
// codebase implements the spec's "optional" auth yet, so these do not return viewer-specific data.
@Controller('streams')
export class StreamsController {
  constructor(
    private readonly streaming: StreamingService,
    private readonly sales: SalesService,
    private readonly storage: StorageService,
  ) {}

  // Declared before `:id` so the static path is never read as a session id.
  @Get('live')
  async listLive(
    @Query(new ZodValidationPipe(ListLiveStreamsQuerySchema)) query: ListLiveStreamsQueryDto,
  ): Promise<{ data: unknown }> {
    const page = await this.streaming.listLiveSessions({
      cursor: query.cursor ?? null,
      limit: query.limit,
    });
    const thumbnailUrlFor = (key: string): string => this.storage.getPublicUrl(key);
    return {
      data: {
        items: page.items.map((item) => toPublicStreamSessionView(item, thumbnailUrlFor)),
        nextCursor: page.nextCursor,
      },
    };
  }

  @Get(':id')
  async getSession(@Param('id') sessionId: string): Promise<{ data: unknown }> {
    const result = await this.streaming.getSessionDetail({ sessionId });
    if (!result.ok) throw toHttpException(result.error);
    const thumbnailUrlFor = (key: string): string => this.storage.getPublicUrl(key);
    return { data: toPublicStreamSessionView(result.value, thumbnailUrlFor) };
  }

  @Get(':id/purchases')
  async listSessionPurchases(
    @Param('id') sessionId: string,
    @Query(new ZodValidationPipe(ListSessionPurchasesQuerySchema))
    query: ListSessionPurchasesQueryDto,
  ): Promise<{ data: unknown }> {
    const page = await this.sales.listSessionPurchases({
      sessionId,
      cursor: query.cursor,
      limit: query.limit,
    });
    return {
      data: {
        items: page.items.map((p) => ({
          saleId: p.saleId,
          productId: p.productId,
          productTitle: p.productTitle,
          productImageUrl: p.productImageUrl,
          mode: p.mode,
          currency: p.currency,
          finalAmount: p.finalAmount.toString(),
          winnerUserId: p.winnerUserId,
          winnerDisplayName: p.winnerDisplayName,
          resolvedAt: p.resolvedAt.toISOString(),
        })),
        nextCursor: page.nextCursor,
      },
    };
  }

  // Seller-guarded routes below (05-API-SPEC.md §6). Ownership (the session's channel belongs to
  // this seller) is enforced inside each use case, not here — same "404, not 403" precedent as the
  // rest of this module, see start-session.usecase.ts / end-session.usecase.ts.
  @Post()
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async createStream(
    @Body(new ZodValidationPipe(CreateStreamSchema)) dto: CreateStreamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.streaming.createSession({
      userId: user.id,
      title: dto.title,
      scheduledFor: dto.scheduledFor,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: { sessionId: result.value.session.id } };
  }

  @Post(':id/start')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async startStream(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.streaming.startSession({ userId: user.id, sessionId });
    if (!result.ok) throw toHttpException(result.error);
    return {
      data: {
        sessionId: result.value.session.id,
        publishToken: result.value.publisherAccess,
        providerRoomId: result.value.providerRoomId,
        wsUrl: appConfig.publicRealtimeUrl,
      },
    };
  }

  @Post(':id/end')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async endStream(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.streaming.endSession({ userId: user.id, sessionId });
    if (!result.ok) throw toHttpException(result.error);
    return { data: { sessionId: result.value.session.id, status: result.value.session.status } };
  }

  @Post(':id/viewer-token')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async getViewerToken(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.streaming.getViewerAccess({ sessionId, userId: user.id });
    if (!result.ok) throw toHttpException(result.error);
    return {
      data: {
        providerRoomId: result.value.providerRoomId,
        viewerToken: result.value.viewerAccess,
        wsUrl: appConfig.publicRealtimeUrl,
      },
    };
  }

  // Queue routes below — none of this is in 05-API-SPEC.md, built new for the live-streaming
  // work (founder_requests.md §2, decided 14 Oct 2026). Same seller-guarded, ownership-checked
  // pattern as start/end above.
  @Get(':id/queue')
  async listQueue(@Param('id') sessionId: string): Promise<{ data: unknown }> {
    const items = await this.streaming.listQueueItems({ sessionId });
    return { data: { items } };
  }

  @Post(':id/queue')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async addQueueItem(
    @Param('id') sessionId: string,
    @Body(new ZodValidationPipe(AddQueueItemSchema)) dto: AddQueueItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.streaming.addQueueItem(
      dto.mode === 'AUCTION'
        ? {
            userId: user.id,
            sessionId,
            productId: dto.productId,
            mode: 'AUCTION',
            startAmount: dto.startAmount,
          }
        : dto.mode === 'BUY_NOW'
          ? {
              userId: user.id,
              sessionId,
              productId: dto.productId,
              mode: 'BUY_NOW',
              price: dto.price,
              quantity: dto.quantity,
            }
          : { userId: user.id, sessionId, productId: dto.productId, mode: 'OFFER' },
    );
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value.item };
  }

  @Patch(':id/queue/reorder')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async reorderQueue(
    @Param('id') sessionId: string,
    @Body(new ZodValidationPipe(ReorderQueueItemsSchema)) dto: ReorderQueueItemsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.streaming.reorderQueueItems({ userId: user.id, sessionId, ...dto });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post(':id/queue/:itemId/feature')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async featureQueueItem(
    @Param('id') sessionId: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(FeatureQueueItemSchema)) dto: FeatureQueueItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.streaming.featureQueueItem(
      dto.mode === 'AUCTION'
        ? {
            userId: user.id,
            sessionId,
            itemId,
            currency: dto.currency,
            mode: 'AUCTION',
            startAmount: dto.startAmount,
            ...(dto.durationSeconds !== undefined ? { durationSeconds: dto.durationSeconds } : {}),
          }
        : dto.mode === 'BUY_NOW'
          ? {
              userId: user.id,
              sessionId,
              itemId,
              currency: dto.currency,
              mode: 'BUY_NOW',
              price: dto.price,
              quantity: dto.quantity,
            }
          : {
              userId: user.id,
              sessionId,
              itemId,
              currency: dto.currency,
              mode: 'OFFER',
            },
    );
    if (!result.ok) throw toHttpException(result.error);
    return { data: { item: result.value.item, saleId: result.value.saleId } };
  }

  // Pause/resume the automatic feature-product queue (founder-feedback round5 §5, 26 Oct 2026) — a
  // per-show toggle, not a seller-level default; see ToggleAutoQueueUseCase's own comment.
  @Patch(':id/queue/auto')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async toggleAutoQueue(
    @Param('id') sessionId: string,
    @Body(new ZodValidationPipe(ToggleAutoQueueSchema)) dto: ToggleAutoQueueDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.streaming.toggleAutoQueue({
      userId: user.id,
      sessionId,
      enabled: dto.enabled,
    });
    if (!result.ok) throw toHttpException(result.error);
    return {
      data: {
        sessionId: result.value.session.id,
        autoQueueEnabled: result.value.session.autoQueueEnabled,
      },
    };
  }

  // Randomizes which PENDING item goes live next (founder "spin the wheel" request, 21 Oct 2026)
  // — broadcasts the pick, opens no Sale. See SpinQueueWheelUseCase's own comment.
  @Post(':id/queue/spin')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async spinQueueWheel(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.streaming.spinQueueWheel({ userId: user.id, sessionId });
    if (!result.ok) throw toHttpException(result.error);
    return { data: { item: result.value.item } };
  }

  // Stream moderation routes (Phase B — seller can add/remove mods, mods can timeout users)
  @Post(':id/mods')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async addModerator(
    @Param('id') sessionId: string,
    @Body(new ZodValidationPipe(AddModeratorSchema)) dto: AddModeratorDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.streaming.addModerator({
      requesterUserId: user.id,
      sessionId,
      userId: dto.userId,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Delete(':id/mods/:moderatorId')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async removeModerator(
    @Param('id') sessionId: string,
    @Param('moderatorId') moderatorId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.streaming.removeModerator({
      requesterUserId: user.id,
      sessionId,
      moderatorId,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Get(':id/mods')
  async listModerators(
    @Param('id') sessionId: string,
    @Query(new ZodValidationPipe(ListModeratorsQuerySchema)) query: ListModeratorsQueryDto,
  ): Promise<{ data: unknown }> {
    const page = await this.streaming.listModerators({
      sessionId,
      cursor: query.cursor,
      limit: query.limit,
    });
    return { data: { items: page.items, nextCursor: page.nextCursor } };
  }

  @Post(':id/chat/timeout')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async timeoutUser(
    @Param('id') sessionId: string,
    @Body(new ZodValidationPipe(TimeoutUserSchema)) dto: TimeoutUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.streaming.timeoutUser({
      moderatorUserId: user.id,
      sessionId,
      userId: dto.userId,
      durationMinutes: dto.durationMinutes,
      reason: dto.reason,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Get(':id/chat/timeouts')
  async listTimeouts(
    @Param('id') sessionId: string,
    @Query(new ZodValidationPipe(ListTimeoutsQuerySchema)) query: ListTimeoutsQueryDto,
  ): Promise<{ data: unknown }> {
    const page = await this.streaming.listTimeouts({
      sessionId,
      userId: query.userId ?? undefined,
      activeOnly: query.activeOnly ?? undefined,
      cursor: query.cursor,
      limit: query.limit,
    });
    return { data: { items: page.items, nextCursor: page.nextCursor } };
  }
}
