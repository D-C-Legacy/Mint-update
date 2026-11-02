import { api } from './index';

// GET /v1/seller/analytics/* — the real seller analytics endpoints (hardening backlog Phase 2b/2c),
// mirroring the admin analytics routes' shapes. Any authed caller works — a caller with no seller
// profile gets empty/zero results rather than an error. Revenue is minor units over the wire.
//
// Revenue arrives as minor units in a plain JSON number (backend's global BigInt polyfill —
// settled against a real responses-series during 2d's live verification: numeric, never quoted).
export type OrdersSummaryPoint = { day: string; orderCount: number; revenue: number };
export type StatusCount = { status: string; count: number };
export type ViewersSummary = { totalPeakViewers: number; conversionRate: number };

// `from`/`to` are ISO datetimes (the backend coerces with z.coerce.date). Omitted → the backend's
// own default 30-day window applies, so "all time" always passes an explicit far-back `from`.
export type SellerAnalyticsRange = { from?: string; to?: string };

export function getOrdersSummary(range: SellerAnalyticsRange = {}): Promise<OrdersSummaryPoint[]> {
  return api.request<OrdersSummaryPoint[]>('/seller/analytics/orders-summary', {
    query: { ...range },
  });
}

export function getOrdersByStatus(): Promise<StatusCount[]> {
  return api.request<StatusCount[]>('/seller/analytics/orders-by-status');
}

// `conversionRate` arrives already as a percentage (10 means 10%), not a 0-1 fraction.
export function getViewersSummary(range: SellerAnalyticsRange = {}): Promise<ViewersSummary> {
  return api.request<ViewersSummary>('/seller/analytics/viewers-summary', {
    query: { ...range },
  });
}
