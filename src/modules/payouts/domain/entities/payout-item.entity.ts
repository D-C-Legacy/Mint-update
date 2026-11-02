export interface PayoutItem {
  readonly id: string;
  readonly payoutId: string;
  readonly orderId: string;
  readonly amount: bigint;
}
