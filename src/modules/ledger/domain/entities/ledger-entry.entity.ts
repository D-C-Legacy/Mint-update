export type EntryDirection = 'DEBIT' | 'CREDIT';

// Pre-persistence shape — no id/transactionId/createdAt yet. Those are assigned once the
// application layer (P7-03's ledger.service.ts#post()) actually writes the transaction;
// building one of these is pure and has no I/O.
export interface LedgerEntryDraft {
  readonly accountId: string;
  readonly direction: EntryDirection;
  readonly amount: bigint; // always positive — direction carries the sign
  readonly currency: string;
}

export interface LedgerEntry extends LedgerEntryDraft {
  readonly id: string;
  readonly transactionId: string;
  readonly createdAt: Date;
}
