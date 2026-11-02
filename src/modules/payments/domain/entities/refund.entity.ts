export type RefundStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface Refund {
  readonly id: string;
  readonly paymentId: string;
  readonly providerRefundId: string;
  readonly amount: bigint;
  readonly reason: string;
  readonly status: RefundStatus;
  readonly initiatedByUserId: string | null;
  readonly createdAt: Date;
}
