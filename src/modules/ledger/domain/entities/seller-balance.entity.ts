export interface SellerBalanceAmounts {
  readonly pendingAmount: bigint;
  readonly availableAmount: bigint;
  readonly paidOutAmount: bigint;
}

export interface SellerBalance extends SellerBalanceAmounts {
  readonly sellerId: string;
  readonly currency: string;
  readonly lastEntryId: string | null;
  readonly updatedAt: Date;
}
