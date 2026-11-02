import { LedgerAccount, LedgerAccountType } from '../entities/ledger-account.entity';
import { LedgerTransaction } from '../entities/ledger-transaction.entity';
import { EntryDirection } from '../entities/ledger-entry.entity';
import { SellerBalance, SellerBalanceAmounts } from '../entities/seller-balance.entity';
import { SellerLedgerEntry } from '../entities/seller-ledger-entry.entity';

export const LEDGER_REPOSITORY = Symbol('LedgerRepositoryPort');

export interface CreateAccountInput {
  readonly id: string;
  readonly type: LedgerAccountType;
  readonly ownerId: string | null;
  readonly currency: string;
}

export interface CreateTransactionEntryInput {
  readonly id: string;
  readonly accountId: string;
  readonly direction: EntryDirection;
  readonly amount: bigint;
  readonly currency: string;
}

export interface CreateTransactionInput {
  readonly id: string;
  readonly type: string;
  readonly idempotencyKey: string;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly description: string | undefined;
  readonly entries: readonly CreateTransactionEntryInput[];
}

export interface CreateTransactionOutcome {
  readonly transaction: LedgerTransaction;
  // Distinguishes a genuine first write from both the idempotent-replay fast path and a
  // concurrent-race loser resolved to the winning row — the caller (LedgerService.post()) must
  // apply SellerBalance's incremental update exactly once per transaction, never on a replay or
  // a lost race, or the projection double-counts.
  readonly created: boolean;
}

export interface LedgerRepositoryPort {
  /** `@@unique([type, ownerId, currency])` — a plain filtered lookup, not a typed `findUnique`,
   *  because Prisma's generated compound-unique `WhereUniqueInput` can't carry `null` for the
   *  nullable `ownerId` member (found live in P7-01's seed script). */
  findAccount(type: LedgerAccountType, ownerId: string | null, currency: string): Promise<LedgerAccount | null>;
  /** Same compound-unique constraint as above — a genuine concurrent race creating the same
   *  not-yet-existing account (e.g. two handlers both posting a seller's first-ever
   *  SELLER_PENDING entry) hits a P2002, disambiguated here and resolved to the WINNING row,
   *  same "fetch-and-return-existing" shape as P3-04's slug collision / P6-07's Payment race. */
  createAccount(input: CreateAccountInput): Promise<LedgerAccount>;
  findTransactionByIdempotencyKey(idempotencyKey: string): Promise<LedgerTransaction | null>;
  /** `LedgerTransaction.idempotencyKey` is `@unique` — one Prisma nested-write call
   *  (`entries: { create: [...] }`), already atomic in a single round trip per Prisma's own
   *  implicit-transaction semantics for nested writes, no `TransactionManager` needed (same
   *  "prefer Prisma nested writes" precedent as P2-03's Seller+SellerApplication aggregate).
   *  A genuine concurrent replay with the same idempotencyKey hits a P2002 here; disambiguated
   *  and resolved to the WINNING row, same shape as `createAccount` above — this, not a
   *  lookup-first fast path alone, is what makes `post()` genuinely idempotent under real
   *  concurrent replay (07-IMPLEMENTATION-PLAN.md's P7 acceptance: "order.paid replayed 10
   *  times posts once"). */
  createTransaction(input: CreateTransactionInput): Promise<CreateTransactionOutcome>;
  findSellerBalance(sellerId: string): Promise<SellerBalance | null>;
  /** Adds `delta` to the existing row (creating it at exactly `delta` if the seller has never
   *  had a balance row before) — the "maintained from entries" side effect `LedgerService.post()`
   *  applies once per genuinely new transaction. A single atomic `UPDATE ... SET x = x + delta`
   *  (Prisma's `increment`), safe under concurrent posts touching the same seller without a lock. */
  incrementSellerBalance(
    sellerId: string,
    currency: string,
    delta: SellerBalanceAmounts,
    lastEntryId: string | null,
  ): Promise<SellerBalance>;
  /** Overwrites the row with `amounts` exactly — `rebuildBalance()`'s "recompute from scratch,"
   *  never an increment. */
  replaceSellerBalance(
    sellerId: string,
    currency: string,
    amounts: SellerBalanceAmounts,
    lastEntryId: string | null,
  ): Promise<SellerBalance>;
  /** Net (credit − debit) across every `LedgerEntry` ever posted to the account identified by
   *  `ownerId`/`type`/`currency` (`ownerId: null` for a platform account) — the raw aggregate
   *  `rebuildBalance()` computes independently for each of the 3 seller-owned account types,
   *  and P7-08's reconciliation job computes for `PLATFORM_CASH`, straight from entries, never
   *  from any cached projection. **Sign is liability-normal** (correct as-is for
   *  SELLER_PENDING/AVAILABLE/PAID_OUT, where a credit is what's owed) — a caller reading an
   *  asset-normal account like `PLATFORM_CASH` (which increases via DEBIT) must negate the
   *  result; see `LedgerService.getReconciliationReport()`'s own comment on `ledgerCashBalance`. */
  sumAccountEntries(ownerId: string | null, currency: string, type: LedgerAccountType): Promise<bigint>;
  /** Most recent entry id across this seller's 3 account types, for `rebuildBalance()`'s own
   *  `lastEntryId` watermark. Null if the seller has no entries at all yet. */
  findLatestSellerEntryId(sellerId: string, currency: string): Promise<string | null>;
  /** `sellerId`s whose cached `SellerBalance.availableAmount` is currently > 0 — `modules/payouts`'
   *  own cheap pre-filter for "which sellers even need considering this run," reading the
   *  projection (fast) rather than re-summing every seller's entries (the ledger's own job,
   *  `sumSellerAccountEntries`, stays the authoritative source payouts separately sums per
   *  order via `findDeliveredOrderCredits` below). */
  findSellersWithPositiveAvailableBalance(currency: string): Promise<readonly string[]>;
  /** Every `order.delivered` transaction's `SELLER_AVAILABLE` credit for this seller — the
   *  `(orderId, amount)` pairs `modules/payouts` enumerates to build a payout's `PayoutItem`
   *  rows and statement, straight from the ledger's own entries (never from the cached
   *  `SellerBalance` projection, which has no per-order breakdown). */
  findDeliveredOrderCredits(sellerId: string, currency: string): Promise<ReadonlyArray<{ orderId: string; amount: bigint }>>;
  /** Every `LedgerTransaction.id` whose entries do NOT sum to zero (debits ≠ credits) — a
   *  direct, independent re-check of the exact invariant `buildLedgerTransaction()` (P7-02)
   *  enforces at construction time. Should always come back empty in a healthy system; this is
   *  P7-08's reconciliation job proving that in the real, live data, not just trusting the
   *  write path was never bypassed. */
  findUnbalancedTransactionIds(): Promise<readonly string[]>;
  /** Every `sellerId` with an existing `SellerBalance` row — P7-08's reconciliation job's own
   *  enumeration for "which sellers to re-check projections against entries for." A seller with
   *  no row yet has had no ledger activity at all, trivially nothing to reconcile. */
  findSellerIdsWithBalance(): Promise<readonly string[]>;
  /** `GET /seller/ledger` (05-API-SPEC.md §10: "Entry history, paginated") — every `LedgerEntry`
   *  across this seller's 3 owned account types, newest first, each enriched with its parent
   *  transaction's type/reference and its own account's type (for display: "order.paid · pending
   *  +$15.00"). Cursor is the last row's id, same idiom as every other list query. */
  findEntriesForSeller(filter: ListSellerEntriesFilter): Promise<SellerLedgerEntry[]>;
}

export interface ListSellerEntriesFilter {
  readonly sellerId: string;
  readonly currency: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}
