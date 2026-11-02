import { SellerOrdersSummaryPoint, SellerStatusCount } from '../entities/seller-analytics.entity';

export const SELLER_ANALYTICS_REPOSITORY = Symbol('SellerAnalyticsRepositoryPort');

export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}

export interface SellerAnalyticsRepositoryPort {
  /** Day-bucketed order counts + revenue for one seller, PAID/COMPLETED only — same "only
   *  settled revenue counts" restriction as modules/admin's AnalyticsRepositoryPort.ordersSummary. */
  ordersSummary(sellerId: string, range: DateRange): Promise<readonly SellerOrdersSummaryPoint[]>;
  /** Plain current-snapshot counts by status for one seller, no date range. */
  ordersByStatus(sellerId: string): Promise<readonly SellerStatusCount[]>;
}
