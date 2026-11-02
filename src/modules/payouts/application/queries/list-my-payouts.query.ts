import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok } from '../../../../shared/result/result';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { PAYOUT_REPOSITORY, PayoutRepositoryPort } from '../../domain/ports/payout.repository.port';
import { Payout, PayoutStatus } from '../../domain/entities/payout.entity';
import { SellersService } from '../../../sellers/application/sellers.service';
import { SellerApplicationNotFoundError } from '../../../sellers/domain/errors/sellers.errors';

export interface ListMyPayoutsCommand {
  readonly userId: string;
  readonly status: PayoutStatus | undefined;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// `GET /seller/payouts` (05-API-SPEC.md §10: "Payout history"). Resolves the caller's own seller
// id the same way every other seller-scoped query in this build does (ShipOrderUseCase,
// LedgerService.getBalanceForUser) — not a new pattern, just this query's own first use of it.
@Injectable()
export class ListMyPayoutsQuery {
  constructor(
    @Inject(PAYOUT_REPOSITORY) private readonly payouts: PayoutRepositoryPort,
    private readonly sellers: SellersService,
  ) {}

  async execute(cmd: ListMyPayoutsCommand): Promise<Result<CursorPage<Payout>, SellerApplicationNotFoundError>> {
    const resolved = await this.sellers.getMySeller({ userId: cmd.userId });
    if (!resolved.ok) {
      return resolved;
    }
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.payouts.findBySeller({
      sellerId: resolved.value.seller.id,
      status: cmd.status,
      cursor: cmd.cursor,
      limit,
    });
    return Ok(buildCursorPage(rows, limit));
  }
}
