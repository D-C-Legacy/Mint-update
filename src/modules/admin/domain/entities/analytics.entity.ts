// Result shapes for the admin analytics dashboard (admin-portal Phase 5). Money stays `bigint`
// internally, same convention as every other amount in this codebase (AGENTS.md §4) — the global
// BigInt.prototype.toJSON polyfill (shared/money/bigint-json.ts) handles serialization.

export interface OrdersSummaryPoint {
  readonly day: Date;
  readonly orderCount: number;
  readonly revenue: bigint;
}

export interface StatusCount {
  readonly status: string;
  readonly count: number;
}

export interface SellerApprovalPoint {
  readonly day: Date;
  readonly approvalCount: number;
}

export interface SellersSummary {
  readonly byStatus: readonly StatusCount[];
  readonly approvalsOverTime: readonly SellerApprovalPoint[];
}

export interface PayoutStatusSummary {
  readonly status: string;
  readonly count: number;
  readonly totalAmount: bigint;
}
