import {
  OrdersSummaryPoint,
  PayoutStatusSummary,
  SellersSummary,
  StatusCount,
} from '../entities/analytics.entity';

export const ANALYTICS_REPOSITORY = Symbol('AnalyticsRepositoryPort');

export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}

export interface AnalyticsRepositoryPort {
  /** Day-bucketed order counts + revenue, PAID/COMPLETED only (the only statuses that represent
   *  real settled revenue — PENDING_PAYMENT never charged, CANCELLED/REFUNDED/DISPUTED shouldn't
   *  count as revenue either). */
  ordersSummary(range: DateRange): Promise<readonly OrdersSummaryPoint[]>;
  /** Plain current-snapshot counts by status, no date range — "how many orders are in each state
   *  right now," not a time series. */
  ordersByStatus(): Promise<readonly StatusCount[]>;
  /** Current seller counts by status, plus day-bucketed approvals over the given range
   *  (`Seller.approvedAt`, set once at approval — see ApproveApplicationUseCase/the P2 build). */
  sellersSummary(range: DateRange): Promise<SellersSummary>;
  /** Current payout counts + summed amounts by status, no date range — same "snapshot, not time
   *  series" reasoning as ordersByStatus. */
  payoutsSummary(): Promise<readonly PayoutStatusSummary[]>;
}
