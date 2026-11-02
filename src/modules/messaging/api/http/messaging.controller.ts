import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { MessagingService } from '../../application/messaging.service';
import { SellersService } from '../../../sellers/application/sellers.service';
import { IdentityService } from '../../../identity/application/identity.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { StartConversationSchema, StartConversationDto } from './dto/start-conversation.dto';
import { SendMessageSchema, SendMessageDto } from './dto/send-message.dto';
import { ListQuerySchema, ListQueryDto } from './dto/list-query.dto';
import { toConversationView } from './conversation.view';
import { toMessageView } from './message.view';
import { Conversation } from '../../domain/entities/conversation.entity';

// Not in 05-API-SPEC.md — no messaging model exists in the docs at all (confirmed Phase 8
// scoping, 13 Oct 2026). User-directed addition, same precedent as reviews/notifications/orders'
// own additions this integration task has made throughout.
@Controller()
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly sellers: SellersService,
    private readonly identity: IdentityService,
  ) {}

  private async toView(conversation: Conversation, viewerUserId: string): Promise<Record<string, unknown>> {
    const isBuyer = conversation.buyerUserId === viewerUserId;
    if (isBuyer) {
      const seller = await this.sellers.getSellerById({ sellerId: conversation.sellerId });
      return toConversationView(conversation, viewerUserId, {
        id: conversation.sellerId,
        displayName: seller?.displayName ?? 'Seller',
      });
    }
    const buyer = await this.identity.getUserById({ userId: conversation.buyerUserId });
    return toConversationView(conversation, viewerUserId, {
      id: conversation.buyerUserId,
      displayName: buyer?.displayName ?? 'Buyer',
    });
  }

  @Get('me/conversations')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async listMine(
    @Query(new ZodValidationPipe(ListQuerySchema)) query: ListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const page = await this.messaging.listMyConversations({ userId: user.id, cursor: query.cursor, limit: query.limit });
    const items = await Promise.all(page.items.map((c) => this.toView(c, user.id)));
    return { data: { items, nextCursor: page.nextCursor } };
  }

  @Post('me/conversations')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async start(
    @Body(new ZodValidationPipe(StartConversationSchema)) dto: StartConversationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.messaging.startConversation({ buyerUserId: user.id, sellerId: dto.sellerId, body: dto.body });
    if (!result.ok) throw toHttpException(result.error);
    return { data: await this.toView(result.value, user.id) };
  }

  @Get('me/conversations/:id/messages')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async listMessages(
    @Param('id') conversationId: string,
    @Query(new ZodValidationPipe(ListQuerySchema)) query: ListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.messaging.listMessages({
      conversationId,
      userId: user.id,
      cursor: query.cursor,
      limit: query.limit,
    });
    if (!result.ok) throw toHttpException(result.error);
    return {
      data: { items: result.value.items.map((m) => toMessageView(m, user.id)), nextCursor: result.value.nextCursor },
    };
  }

  @Post('me/conversations/:id/messages')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async sendReply(
    @Param('id') conversationId: string,
    @Body(new ZodValidationPipe(SendMessageSchema)) dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.messaging.sendMessage({ conversationId, senderUserId: user.id, body: dto.body });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toMessageView(result.value, user.id) };
  }

  @Post('me/conversations/:id/read')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async markRead(@Param('id') conversationId: string, @CurrentUser() user: AuthenticatedUser): Promise<{ data: unknown }> {
    const result = await this.messaging.markRead({ conversationId, userId: user.id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: await this.toView(result.value, user.id) };
  }
}
