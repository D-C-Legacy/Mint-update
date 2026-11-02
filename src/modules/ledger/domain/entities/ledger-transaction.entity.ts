import { LedgerEntry } from './ledger-entry.entity';

export interface LedgerTransaction {
  readonly id: string;
  readonly type: string;
  readonly idempotencyKey: string;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly entries: readonly LedgerEntry[];
}
