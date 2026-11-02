import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LedgerService } from '../../application/ledger.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { ListSellerEntriesQuerySchema, ListSellerEntriesQueryDto } from './dto/list-seller-entries-query.dto';
import { toSellerBalanceView, toSellerLedgerEntryView } from './ledger.view';

// 05-API-SPEC.md §10's seller-facing balance/ledger routes — no HTTP route existed for either
// before this.
@Controller()
@UseGuards(JwtGuard, DefaultRateLimitGuard)
export class SellerLedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get('seller/balance')
  async getBalance(@CurrentUser() user: AuthenticatedUser): Promise<{ data: unknown }> {
    const result = await this.ledger.getBalanceForUser({ userId: user.id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toSellerBalanceView(result.value) };
  }

  @Get('seller/ledger')
  async listEntries(
    @Query(new ZodValidationPipe(ListSellerEntriesQuerySchema)) query: ListSellerEntriesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.ledger.listEntriesForUser({ userId: user.id, cursor: query.cursor, limit: query.limit });
    if (!result.ok) throw toHttpException(result.error);
    return { data: { items: result.value.items.map(toSellerLedgerEntryView), nextCursor: result.value.nextCursor } };
  }
}
