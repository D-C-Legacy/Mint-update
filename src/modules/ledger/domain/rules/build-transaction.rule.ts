import { LedgerEntryDraft } from '../entities/ledger-entry.entity';

export interface BuildTransactionInput {
  readonly type: string; // order.paid, order.delivered, payout.sent ...
  readonly idempotencyKey: string; // replay protection
  readonly referenceType: string; // order, payout, refund
  readonly referenceId: string;
  readonly description?: string;
  readonly entries: readonly LedgerEntryDraft[];
}

// Pre-persistence shape of a LedgerTransaction + its entries. buildLedgerTransaction() is the
// only way to get one of these — there is no other constructor, so every instance in this
// codebase is already known to balance.
export interface LedgerTransactionDraft {
  readonly type: string;
  readonly idempotencyKey: string;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly description: string | undefined;
  readonly entries: readonly LedgerEntryDraft[];
}

// 03-DATA-MODEL.md §10 / 01-ARCHITECTURE.md §5: "every ledger entry has a matching
// counter-entry, debits equal credits, always." Enforced here, at construction, not deferred
// to whoever eventually calls ledger.service.ts#post() (P7-03). Throws rather than returning
// a Result — an unbalanced transaction can only happen from a bug in the caller (every real
// caller in this codebase composes a fixed, known entry set, e.g. P7-04's 5-entry
// order.paid posting), never a user-reachable business outcome, matching the "throw only for
// genuinely unexpected conditions" rule (AGENTS.md §7) and this ticket's own acceptance
// criterion ("constructing an unbalanced transaction throws").
export function buildLedgerTransaction(input: BuildTransactionInput): LedgerTransactionDraft {
  if (input.entries.length < 2) {
    throw new Error('A ledger transaction needs at least one debit entry and one credit entry');
  }

  for (const entry of input.entries) {
    if (entry.amount <= 0n) {
      throw new Error(
        `Ledger entry amount must be positive, got ${entry.amount.toString()} for account ${entry.accountId}`,
      );
    }
  }

  const totalsByCurrency = new Map<string, { debit: bigint; credit: bigint }>();
  for (const entry of input.entries) {
    const totals = totalsByCurrency.get(entry.currency) ?? { debit: 0n, credit: 0n };
    if (entry.direction === 'DEBIT') {
      totals.debit += entry.amount;
    } else {
      totals.credit += entry.amount;
    }
    totalsByCurrency.set(entry.currency, totals);
  }

  for (const [currency, totals] of totalsByCurrency) {
    if (totals.debit !== totals.credit) {
      throw new Error(
        `Unbalanced ledger transaction (${currency}): debits=${totals.debit.toString()} credits=${totals.credit.toString()}`,
      );
    }
  }

  return {
    type: input.type,
    idempotencyKey: input.idempotencyKey,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    description: input.description,
    entries: input.entries,
  };
}
