import { SellerBalance } from '../../domain/entities/seller-balance.entity';
import { SellerLedgerEntry } from '../../domain/entities/seller-ledger-entry.entity';

// Shape for GET /seller/balance. 05-API-SPEC.md's own example response includes
// `nextPayoutDate` — deliberately not here, see LedgerService.getBalanceForUser's comment: no
// scheduler/cron exists anywhere in this codebase to compute one from.
export interface SellerBalanceView {
  readonly currency: string;
  readonly pendingAmount: number;
  readonly availableAmount: number;
  readonly paidOutAmount: number;
}

export function toSellerBalanceView(balance: SellerBalance): SellerBalanceView {
  return {
    currency: balance.currency,
    pendingAmount: Number(balance.pendingAmount),
    availableAmount: Number(balance.availableAmount),
    paidOutAmount: Number(balance.paidOutAmount),
  };
}

// Shape for GET /seller/ledger.
export interface SellerLedgerEntryView {
  readonly id: string;
  readonly transactionType: string;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly accountType: string;
  readonly direction: string;
  readonly amount: number;
  readonly currency: string;
  readonly createdAt: string;
}

export function toSellerLedgerEntryView(entry: SellerLedgerEntry): SellerLedgerEntryView {
  return {
    id: entry.id,
    transactionType: entry.transactionType,
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
    accountType: entry.accountType,
    direction: entry.direction,
    amount: Number(entry.amount),
    currency: entry.currency,
    createdAt: entry.createdAt.toISOString(),
  };
}
