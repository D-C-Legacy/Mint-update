import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StreamingService } from '../../application/streaming.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import {
  AnalyticsRangeQuerySchema,
  AnalyticsRangeQueryDto,
} from '../../../../shared/analytics/analytics-range-query.dto';

// Separate controller class (own prefix) rather than adding this onto streams.controller.ts —
// that class is prefixed `@Controller('streams')`, and this route belongs at `/seller/analytics/*`
// alongside orders.controller.ts's seller order-analytics routes (engineering-hardening backlog
// Phase 2), not under `/streams`. Lives in the streaming module anyway (not orders) because the
// underlying data — StreamSession.peakViewers via Channel.sellerId — is streaming's domain.
@Controller('seller/analytics')
export class SellerAnalyticsController {
  constructor(private readonly streaming: StreamingService) {}

  @Get('viewers-summary')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async getViewersSummary(
    @Query(new ZodValidationPipe(AnalyticsRangeQuerySchema)) query: AnalyticsRangeQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.streaming.getSellerViewersSummary({
      sellerUserId: user.id,
      from: query.from,
      to: query.to,
    });
    return { data: result };
  }
}
