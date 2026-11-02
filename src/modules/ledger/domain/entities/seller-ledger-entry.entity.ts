import { LedgerAccountType } from './ledger-account.entity';
import { EntryDirection } from './ledger-entry.entity';

// A read-model projection for `GET /seller/ledger` (05-API-SPEC.md §10: "Entry history,
// paginated") — not the pure `LedgerEntry` aggregate, which carries no transaction/account
// context of its own. Same "small facade addition a later ticket's own job genuinely needs"
// precedent as `SellerApplicationSummary`.
export interface SellerLedgerEntry {
  readonly id: string;
  readonly transactionType: string; // order.paid, order.delivered, payout.sent ...
  readonly referenceType: string; // order, payout, refund
  readonly referenceId: string;
  readonly accountType: LedgerAccountType; // which of the seller's 3 accounts this entry hit
  readonly direction: EntryDirection;
  readonly amount: bigint;
  readonly currency: string;
  readonly createdAt: Date;
}
