import { Inject, Injectable } from '@nestjs/common';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../../domain/ports/stream-session.repository.port';
import { SellersService } from '../../../sellers/application/sellers.service';
import { OrdersService } from '../../../orders/application/orders.service';
import {
  AnalyticsRangeCommand,
  resolveAnalyticsRange,
} from '../../../../shared/analytics/analytics-range.util';

export type GetSellerViewersSummaryCommand = AnalyticsRangeCommand & {
  readonly sellerUserId: string;
};

export interface SellerViewersSummary {
  readonly totalPeakViewers: number;
  // Percentage (0-100+), ratio-of-sums (total orders ÷ total peak viewers across the range), not
  // an average of each stream's own ratio — avoids a divide-by-zero-shaped mess for any single
  // stream that had zero viewers, and matches how a seller actually thinks about this number
  // ("how many of everyone who watched anything bought something"), not a per-stream average.
  readonly conversionRate: number;
}

// Engineering-hardening backlog Phase 2c. The numerator here is exactly the same order count
// seller order analytics (Phase 2b) already computes — every Order in this platform traces back
// to a Sale, and every Sale happens inside a stream session (Sale.sessionId is non-nullable), so
// "orders in range" and "stream-sourced orders in range" are the same set. Reusing
// OrdersService.getSellerOrdersSummary rather than a second, parallel order-counting query avoids
// the two ever disagreeing about what counts as a settled order (PAID/COMPLETED).
@Injectable()
export class GetSellerViewersSummaryQuery {
  constructor(
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    private readonly sellers: SellersService,
    private readonly orders: OrdersService,
  ) {}

  async execute(cmd: GetSellerViewersSummaryCommand): Promise<SellerViewersSummary> {
    const seller = await this.sellers.getMySeller({ userId: cmd.sellerUserId });
    if (!seller.ok) {
      return { totalPeakViewers: 0, conversionRate: 0 };
    }

    const range = resolveAnalyticsRange(cmd);
    const [totalPeakViewers, orderPoints] = await Promise.all([
      this.sessions.sumPeakViewersForSeller(seller.value.seller.id, range),
      this.orders.getSellerOrdersSummary({
        sellerUserId: cmd.sellerUserId,
        from: cmd.from,
        to: cmd.to,
      }),
    ]);
    const totalOrders = orderPoints.reduce((sum, point) => sum + point.orderCount, 0);
    const conversionRate = totalPeakViewers > 0 ? (totalOrders / totalPeakViewers) * 100 : 0;

    return { totalPeakViewers, conversionRate };
  }
}
