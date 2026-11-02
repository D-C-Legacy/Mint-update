import { Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from '../../application/notifications.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import {
  ListNotificationsQuerySchema,
  ListNotificationsQueryDto,
} from './dto/list-notifications-query.dto';
import { toNotificationView } from './notification.view';

// Not in 05-API-SPEC.md: added for the Phase 6 app-integration inbox (user-directed, same
// precedent as change-password/preferences/addresses). NotificationDelivery existed already
// (P8-04) with no way to read it back; this is the first.
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('me/notifications')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async listMine(
    @Query(new ZodValidationPipe(ListNotificationsQuerySchema)) query: ListNotificationsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const { page, unreadCount } = await this.notifications.listMine({
      userId: user.id,
      cursor: query.cursor,
      limit: query.limit,
    });
    return {
      data: { items: page.items.map(toNotificationView), nextCursor: page.nextCursor, unreadCount },
    };
  }

  @Post('me/notifications/:id/read')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async markRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.notifications.markRead({ id, userId: user.id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toNotificationView(result.value) };
  }

  // Not in 05-API-SPEC.md: mark-all-read for the Activity screen (Phase 4, user-directed, same
  // non-spec precedent as the read-one route). No input to validate, so no DTO — the boundary is
  // the authenticated user itself.
  @Post('me/notifications/read-all')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async markAllRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: { updated: number } }> {
    const updated = await this.notifications.markAllRead({ userId: user.id });
    return { data: { updated } };
  }

  // Not in 05-API-SPEC.md: delete for the Activity screen (Phase 4, user-directed soft delete —
  // the send record survives behind a deletedAt filter; a foreign or already-deleted id 404s).
  @Delete('me/notifications/:id')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async deleteNotification(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: { id: string; deleted: boolean } }> {
    const result = await this.notifications.deleteNotification({ id, userId: user.id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: { id, deleted: true } };
  }
}
