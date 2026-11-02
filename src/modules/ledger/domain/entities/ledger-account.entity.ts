export type LedgerAccountType =
  | 'PLATFORM_CASH' // money we hold in the bank
  | 'PLATFORM_REVENUE' // commission earned
  | 'PROCESSOR_FEES' // what the processor took
  | 'SELLER_PENDING' // owed but not releasable
  | 'SELLER_AVAILABLE' // owed and releasable
  | 'SELLER_PAID_OUT' // already transferred
  | 'REFUNDS_PAYABLE';

export interface LedgerAccount {
  readonly id: string;
  readonly type: LedgerAccountType;
  readonly ownerId: string | null; // sellerId for seller accounts, null for platform
  readonly currency: string;
  readonly createdAt: Date;
}
