import { Inject, Injectable } from '@nestjs/common';
import {
  SELLER_ANALYTICS_REPOSITORY,
  SellerAnalyticsRepositoryPort,
} from '../../domain/ports/seller-analytics.repository.port';
import { SellerOrdersSummaryPoint } from '../../domain/entities/seller-analytics.entity';
import { SellersService } from '../../../sellers/application/sellers.service';
import {
  AnalyticsRangeCommand,
  resolveAnalyticsRange,
} from '../../../../shared/analytics/analytics-range.util';

export type GetSellerOrdersSummaryCommand = AnalyticsRangeCommand & {
  readonly sellerUserId: string;
};

// Seller-scoped mirror of modules/admin's GetOrdersSummaryQuery. A caller with no approved seller
// profile gets an empty series, not an error — same "no seller profile, nothing to show" precedent
// as ListSellerOrdersQuery.
@Injectable()
export class GetSellerOrdersSummaryQuery {
  constructor(
    @Inject(SELLER_ANALYTICS_REPOSITORY) private readonly analytics: SellerAnalyticsRepositoryPort,
    private readonly sellers: SellersService,
  ) {}

  async execute(cmd: GetSellerOrdersSummaryCommand): Promise<readonly SellerOrdersSummaryPoint[]> {
    const seller = await this.sellers.getMySeller({ userId: cmd.sellerUserId });
    if (!seller.ok) {
      return [];
    }
    return this.analytics.ordersSummary(seller.value.seller.id, resolveAnalyticsRange(cmd));
  }
}
