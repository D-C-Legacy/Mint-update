// Typed wrappers around the admin analytics routes. Shapes hand-mirror
// src/modules/admin/domain/entities/analytics.entity.ts. Money (revenue/totalAmount) arrives as
// a plain number via the backend's BigInt.prototype.toJSON polyfill, same as orders/payouts.
import { apiClient } from '../auth/AuthContext';

export type OrdersSummaryPoint = { day: string; orderCount: number; revenue: number };
export type StatusCount = { status: string; count: number };
export type SellerApprovalPoint = { day: string; approvalCount: number };
export type SellersSummary = { byStatus: StatusCount[]; approvalsOverTime: SellerApprovalPoint[] };
export type PayoutStatusSummary = { status: string; count: number; totalAmount: number };

export type AnalyticsRange = { from?: Date; to?: Date };

function rangeQuery(range: AnalyticsRange): Record<string, string | undefined> {
  return {
    from: range.from?.toISOString(),
    to: range.to?.toISOString(),
  };
}

export function getOrdersSummary(range: AnalyticsRange): Promise<OrdersSummaryPoint[]> {
  return apiClient.request('/admin/analytics/orders-summary', { query: rangeQuery(range) });
}

export function getOrdersByStatus(): Promise<StatusCount[]> {
  return apiClient.request('/admin/analytics/orders-by-status');
}

export function getSellersSummary(range: AnalyticsRange): Promise<SellersSummary> {
  return apiClient.request('/admin/analytics/sellers-summary', { query: rangeQuery(range) });
}

export function getPayoutsSummary(): Promise<PayoutStatusSummary[]> {
  return apiClient.request('/admin/analytics/payouts-summary');
}
