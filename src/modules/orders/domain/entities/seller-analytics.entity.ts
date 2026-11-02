// Seller-scoped mirror of modules/admin's analytics.entity.ts (engineering-hardening backlog,
// Phase 2b) — same money-stays-bigint convention (AGENTS.md §4), same global
// BigInt.prototype.toJSON polyfill handles serialization over HTTP.

export interface SellerOrdersSummaryPoint {
  readonly day: Date;
  readonly orderCount: number;
  readonly revenue: bigint;
}

export interface SellerStatusCount {
  readonly status: string;
  readonly count: number;
}
