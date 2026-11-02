import { describe, expect, it } from 'vitest';
import { buildLedgerTransaction, BuildTransactionInput } from './build-transaction.rule';
import { LedgerEntryDraft } from '../entities/ledger-entry.entity';

function entry(accountId: string, direction: 'DEBIT' | 'CREDIT', amount: bigint, currency = 'USD'): LedgerEntryDraft {
  return { accountId, direction, amount, currency };
}

function input(entries: readonly LedgerEntryDraft[], overrides: Partial<BuildTransactionInput> = {}): BuildTransactionInput {
  return {
    type: 'order.paid',
    idempotencyKey: 'idem_1',
    referenceType: 'order',
    referenceId: 'ord_1',
    entries,
    ...overrides,
  };
}

describe('buildLedgerTransaction', () => {
  // 03-DATA-MODEL.md §10's own "Order paid" example (item 10000, commission 1000, processor
  // fee 320): DEBIT PLATFORM_CASH 10000, CREDIT SELLER_PENDING 9000, CREDIT PLATFORM_REVENUE
  // 1000, DEBIT PROCESSOR_FEES 320, CREDIT PLATFORM_CASH 320 — debits 10320 = credits 10320.
  it('builds the doc-specified 5-entry order.paid transaction', () => {
    const entries = [
      entry('acct_platform_cash', 'DEBIT', 10_000n),
      entry('acct_seller_pending', 'CREDIT', 9_000n),
      entry('acct_platform_revenue', 'CREDIT', 1_000n),
      entry('acct_processor_fees', 'DEBIT', 320n),
      entry('acct_platform_cash', 'CREDIT', 320n),
    ];

    const result = buildLedgerTransaction(input(entries));

    expect(result.entries).toBe(entries);
    expect(result.type).toBe('order.paid');
    expect(result.idempotencyKey).toBe('idem_1');
  });

  // 03-DATA-MODEL.md §10's "Order delivered" example — the simplest possible balanced
  // transaction, exactly 2 entries.
  it('builds the doc-specified 2-entry order.delivered transaction', () => {
    const entries = [entry('acct_seller_pending', 'DEBIT', 9_000n), entry('acct_seller_available', 'CREDIT', 9_000n)];

    const result = buildLedgerTransaction(input(entries, { type: 'order.delivered' }));

    expect(result.entries).toHaveLength(2);
  });

  it('carries the optional description through when provided', () => {
    const entries = [entry('a', 'DEBIT', 100n), entry('b', 'CREDIT', 100n)];

    const result = buildLedgerTransaction(input(entries, { description: 'test note' }));

    expect(result.description).toBe('test note');
  });

  it('leaves description undefined when not provided', () => {
    const entries = [entry('a', 'DEBIT', 100n), entry('b', 'CREDIT', 100n)];

    const result = buildLedgerTransaction(input(entries));

    expect(result.description).toBeUndefined();
  });

  it('throws when debits and credits do not match', () => {
    const entries = [entry('a', 'DEBIT', 100n), entry('b', 'CREDIT', 99n)];

    expect(() => buildLedgerTransaction(input(entries))).toThrow(/Unbalanced ledger transaction/);
  });

  it('throws when debits exceed credits by a small amount (off-by-one, not just wildly wrong)', () => {
    const entries = [entry('a', 'DEBIT', 10_001n), entry('b', 'CREDIT', 10_000n)];

    expect(() => buildLedgerTransaction(input(entries))).toThrow(/Unbalanced ledger transaction/);
  });

  it('throws with fewer than two entries (zero entries)', () => {
    expect(() => buildLedgerTransaction(input([]))).toThrow(/at least one debit entry and one credit entry/);
  });

  it('throws with fewer than two entries (one entry)', () => {
    expect(() => buildLedgerTransaction(input([entry('a', 'DEBIT', 100n)]))).toThrow(
      /at least one debit entry and one credit entry/,
    );
  });

  it('throws when an entry amount is zero', () => {
    const entries = [entry('a', 'DEBIT', 0n), entry('b', 'CREDIT', 0n)];

    expect(() => buildLedgerTransaction(input(entries))).toThrow(/amount must be positive/);
  });

  it('throws when an entry amount is negative', () => {
    const entries = [entry('a', 'DEBIT', 100n), entry('b', 'CREDIT', -100n)];

    expect(() => buildLedgerTransaction(input(entries))).toThrow(/amount must be positive/);
  });

  it('two debits and no credits is always unbalanced, never mistaken for valid', () => {
    const entries = [entry('a', 'DEBIT', 100n), entry('b', 'DEBIT', 100n)];

    expect(() => buildLedgerTransaction(input(entries))).toThrow(/Unbalanced ledger transaction/);
  });

  it('balances correctly regardless of entry order', () => {
    const entries = [
      entry('acct_platform_cash', 'CREDIT', 320n),
      entry('acct_processor_fees', 'DEBIT', 320n),
      entry('acct_platform_revenue', 'CREDIT', 1_000n),
      entry('acct_seller_pending', 'CREDIT', 9_000n),
      entry('acct_platform_cash', 'DEBIT', 10_000n),
    ];

    expect(() => buildLedgerTransaction(input(entries))).not.toThrow();
  });

  it('supports more than two entries on the same side as long as the totals match', () => {
    const entries = [entry('a', 'DEBIT', 60n), entry('b', 'DEBIT', 40n), entry('c', 'CREDIT', 100n)];

    expect(() => buildLedgerTransaction(input(entries))).not.toThrow();
  });

  it('balances each currency independently, and a mismatch in only one currency still throws', () => {
    const entries = [
      entry('a', 'DEBIT', 100n, 'USD'),
      entry('b', 'CREDIT', 100n, 'USD'),
      entry('c', 'DEBIT', 50n, 'EUR'),
      entry('d', 'CREDIT', 49n, 'EUR'),
    ];

    expect(() => buildLedgerTransaction(input(entries))).toThrow(/Unbalanced ledger transaction \(EUR\)/);
  });

  it('accepts multiple currencies when each one independently balances', () => {
    const entries = [
      entry('a', 'DEBIT', 100n, 'USD'),
      entry('b', 'CREDIT', 100n, 'USD'),
      entry('c', 'DEBIT', 50n, 'EUR'),
      entry('d', 'CREDIT', 50n, 'EUR'),
    ];

    expect(() => buildLedgerTransaction(input(entries))).not.toThrow();
  });
});
