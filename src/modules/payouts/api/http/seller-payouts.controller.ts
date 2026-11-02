import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PayoutsService } from '../../application/payouts.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { ListMyPayoutsQuerySchema, ListMyPayoutsQueryDto } from './dto/list-my-payouts-query.dto';
import { toPayoutView, toPayoutStatementView } from './payout.view';

// 05-API-SPEC.md §10's seller-facing payout routes — no HTTP route existed anywhere for them
// before this (GetPayoutStatementQuery/ListPayoutsByStatusQuery predate any controller).
@Controller()
@UseGuards(JwtGuard, DefaultRateLimitGuard)
export class SellerPayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('seller/payouts')
  async listMine(
    @Query(new ZodValidationPipe(ListMyPayoutsQuerySchema)) query: ListMyPayoutsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.payouts.listMine({
      userId: user.id,
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: { items: result.value.items.map(toPayoutView), nextCursor: result.value.nextCursor } };
  }

  @Get('seller/payouts/:id')
  async getStatement(
    @Param('id') payoutId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.payouts.getMyStatement({ userId: user.id, payoutId });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toPayoutStatementView(result.value) };
  }
}
