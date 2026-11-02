import { Inject, Injectable } from '@nestjs/common';
import { generateId } from '../../../shared/ids/id';
import { Result, Ok } from '../../../shared/result/result';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../shared/pagination/cursor';
import { LEDGER_REPOSITORY, LedgerRepositoryPort } from '../domain/ports/ledger.repository.port';
import { LedgerAccount, LedgerAccountType } from '../domain/entities/ledger-account.entity';
import { LedgerTransaction } from '../domain/entities/ledger-transaction.entity';
import { EntryDirection, LedgerEntryDraft } from '../domain/entities/ledger-entry.entity';
import { SellerBalance, SellerBalanceAmounts } from '../domain/entities/seller-balance.entity';
import { SellerLedgerEntry } from '../domain/entities/seller-ledger-entry.entity';
import { buildLedgerTransaction } from '../domain/rules/build-transaction.rule';
import { SellersService } from '../../sellers/application/sellers.service';
import { PaymentsService } from '../../payments/application/payments.service';
import { SellerApplicationNotFoundError } from '../../sellers/domain/errors/sellers.errors';

const SELLER_CURRENCY = 'USD'; // the platform's one supported currency (same default rebuildBalance() uses)
const ZERO_SELLER_BALANCE_AMOUNTS: SellerBalanceAmounts = {
  pendingAmount: 0n,
  availableAmount: 0n,
  paidOutAmount: 0n,
};

export interface GetBalanceForUserCommand {
  readonly userId: string;
}

export interface ListEntriesForUserCommand {
  readonly userId: string;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

const SELLER_BALANCE_FIELD_BY_ACCOUNT_TYPE: Partial<
  Record<LedgerAccountType, keyof SellerBalanceAmounts>
> = {
  SELLER_PENDING: 'pendingAmount',
  SELLER_AVAILABLE: 'availableAmount',
  SELLER_PAID_OUT: 'paidOutAmount',
};

const ZERO_BALANCE_DELTA: SellerBalanceAmounts = {
  pendingAmount: 0n,
  availableAmount: 0n,
  paidOutAmount: 0n,
};

export interface PostTransactionEntryCommand {
  readonly accountType: LedgerAccountType;
  readonly ownerId: string | null; // sellerId for seller accounts, null for platform
  readonly direction: EntryDirection;
  readonly amount: bigint;
}

export interface PostTransactionCommand {
  readonly type: string; // order.paid, order.delivered, payout.sent ...
  readonly idempotencyKey: string;
  readonly referenceType: string; // order, payout, refund
  readonly referenceId: string;
  readonly description?: string;
  readonly currency: string;
  readonly entries: readonly PostTransactionEntryCommand[];
}

// 07-IMPLEMENTATION-PLAN.md's P7-03 deliverable: "post(transaction) idempotent by key, append
// only, single DB transaction. This is the only write path into the ledger." No other service
// in this codebase — and no future ticket — should call `LedgerRepositoryPort.createTransaction`
// directly; every posting (P7-04's order.paid, P7-05's order.delivered, payouts' payout.sent)
// goes through this one method.
@Injectable()
export class LedgerService {
  constructor(
    @Inject(LEDGER_REPOSITORY) private readonly ledger: LedgerRepositoryPort,
    private readonly sellers: SellersService,
    private readonly payments: PaymentsService,
  ) {}

  async post(cmd: PostTransactionCommand): Promise<LedgerTransaction> {
    // Fast path for a genuine replay — no account lookups, no entry construction, nothing
    // written. The real correctness guarantee for a true concurrent race is the DB-level
    // unique constraint handled inside `createTransaction` below, not this check.
    const existing = await this.ledger.findTransactionByIdempotencyKey(cmd.idempotencyKey);
    if (existing) {
      return existing;
    }

    const entries: LedgerEntryDraft[] = [];
    for (const entryCmd of cmd.entries) {
      const account = await this.resolveAccount(
        entryCmd.accountType,
        entryCmd.ownerId,
        cmd.currency,
      );
      entries.push({
        accountId: account.id,
        direction: entryCmd.direction,
        amount: entryCmd.amount,
        currency: cmd.currency,
      });
    }

    // Throws if unbalanced (P7-02) — this IS "refuses to construct," before any
    // LedgerTransaction/LedgerEntry row is ever written.
    buildLedgerTransaction({
      type: cmd.type,
      idempotencyKey: cmd.idempotencyKey,
      referenceType: cmd.referenceType,
      referenceId: cmd.referenceId,
      ...(cmd.description !== undefined ? { description: cmd.description } : {}),
      entries,
    });

    const outcome = await this.ledger.createTransaction({
      id: generateId(),
      type: cmd.type,
      idempotencyKey: cmd.idempotencyKey,
      referenceType: cmd.referenceType,
      referenceId: cmd.referenceId,
      description: cmd.description,
      entries: entries.map((entry) => ({ id: generateId(), ...entry })),
    });

    // SellerBalance is a cached projection (01-ARCHITECTURE.md §5: "must be rebuildable from
    // entries") — applied here, once, only for a genuinely new transaction. A replay (the fast
    // path above) or a race lost to createTransaction's own P2002 fallback must NEVER reach this,
    // or the projection double-counts; `created` is exactly what distinguishes those cases.
    if (outcome.created) {
      await this.applyBalanceDeltas(cmd, outcome.transaction);
    }

    return outcome.transaction;
  }

  async getBalance(sellerId: string): Promise<SellerBalance | null> {
    return this.ledger.findSellerBalance(sellerId);
  }

  // For OnPaymentRefundedHandler (3b): what a refund posting needs from the ledger's own
  // records — did order.paid ever post for this order (the gate against refunding a charge
  // whose sale was never ledgered), and what does the seller actually hold right now. The
  // projection IS "what the seller still holds with us" — the exact thing the founder's
  // clawback policy says to draw from first.
  async getRefundPostingContext(cmd: {
    orderId: string;
    sellerId: string;
  }): Promise<{ paidPosted: boolean; pending: bigint; available: bigint }> {
    const paidTx = await this.ledger.findTransactionByIdempotencyKey(`order.paid:${cmd.orderId}`);
    const balance = await this.ledger.findSellerBalance(cmd.sellerId);
    return {
      paidPosted: paidTx !== null,
      pending: balance?.pendingAmount ?? 0n,
      available: balance?.availableAmount ?? 0n,
    };
  }

  // `GET /seller/balance` (05-API-SPEC.md §10). Resolves the caller's own seller id the same way
  // ShipOrderUseCase resolves a seller caller — not invented here, just the first ledger-module
  // caller of it. A seller with no ledger activity yet has no `SellerBalance` row at all
  // (`incrementSellerBalance` creates it lazily on first post): zeros, not an error.
  //
  // The spec's own example response includes `nextPayoutDate` — not returned here: no
  // scheduler/cron exists anywhere in this codebase (payout runs are admin-triggered only, per
  // `PayoutsModule`'s own comment), so there is no real date to compute. Flagged, not invented.
  async getBalanceForUser(
    cmd: GetBalanceForUserCommand,
  ): Promise<Result<SellerBalance, SellerApplicationNotFoundError>> {
    const resolved = await this.sellers.getMySeller({ userId: cmd.userId });
    if (!resolved.ok) {
      return resolved;
    }
    const sellerId = resolved.value.seller.id;
    const balance = await this.ledger.findSellerBalance(sellerId);
    return Ok(
      balance ?? {
        sellerId,
        currency: SELLER_CURRENCY,
        ...ZERO_SELLER_BALANCE_AMOUNTS,
        lastEntryId: null,
        updatedAt: new Date(),
      },
    );
  }

  // `GET /seller/ledger` (05-API-SPEC.md §10: "Entry history, paginated").
  async listEntriesForUser(
    cmd: ListEntriesForUserCommand,
  ): Promise<Result<CursorPage<SellerLedgerEntry>, SellerApplicationNotFoundError>> {
    const resolved = await this.sellers.getMySeller({ userId: cmd.userId });
    if (!resolved.ok) {
      return resolved;
    }
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.ledger.findEntriesForSeller({
      sellerId: resolved.value.seller.id,
      currency: SELLER_CURRENCY,
      cursor: cmd.cursor,
      limit,
    });
    return Ok(buildCursorPage(rows, limit));
  }

  // "Recomputes from scratch" — sums every LedgerEntry ever posted to this seller's 3
  // seller-owned accounts, straight from the append-only ledger, and OVERWRITES the cached
  // projection with that result (never an increment, unlike post()'s own maintenance). The
  // intended reconciliation/recovery path for any drift the incremental path might ever
  // accumulate — safe to call at any time, including on a seller with zero activity (currency
  // defaults to the platform's one supported currency when nothing exists yet to read it from).
  async rebuildBalance(sellerId: string, currency = 'USD'): Promise<SellerBalance> {
    const [pendingAmount, availableAmount, paidOutAmount, lastEntryId] = await Promise.all([
      this.ledger.sumAccountEntries(sellerId, currency, 'SELLER_PENDING'),
      this.ledger.sumAccountEntries(sellerId, currency, 'SELLER_AVAILABLE'),
      this.ledger.sumAccountEntries(sellerId, currency, 'SELLER_PAID_OUT'),
      this.ledger.findLatestSellerEntryId(sellerId, currency),
    ]);

    return this.ledger.replaceSellerBalance(
      sellerId,
      currency,
      { pendingAmount, availableAmount, paidOutAmount },
      lastEntryId,
    );
  }

  private async applyBalanceDeltas(
    cmd: PostTransactionCommand,
    transaction: LedgerTransaction,
  ): Promise<void> {
    const deltaBySeller = new Map<string, SellerBalanceAmounts>();

    for (const entryCmd of cmd.entries) {
      if (entryCmd.ownerId === null) continue; // a platform account, not a seller balance
      const field = SELLER_BALANCE_FIELD_BY_ACCOUNT_TYPE[entryCmd.accountType];
      if (field === undefined) continue; // not one of the 3 seller-owned account types

      const signedAmount = entryCmd.direction === 'CREDIT' ? entryCmd.amount : -entryCmd.amount;
      const delta = deltaBySeller.get(entryCmd.ownerId) ?? ZERO_BALANCE_DELTA;
      deltaBySeller.set(entryCmd.ownerId, { ...delta, [field]: delta[field] + signedAmount });
    }

    if (deltaBySeller.size === 0) {
      return;
    }

    const lastEntryId = transaction.entries[transaction.entries.length - 1]?.id ?? null;
    for (const [sellerId, delta] of deltaBySeller) {
      await this.ledger.incrementSellerBalance(sellerId, cmd.currency, delta, lastEntryId);
    }
  }

  // 03-DATA-MODEL.md §10's "Order delivered" transaction: DEBIT SELLER_PENDING / CREDIT
  // SELLER_AVAILABLE for whatever amount was actually posted to SELLER_PENDING by the
  // order.paid transaction — looked up from the ledger's own prior entries, never recomputed
  // from modules/orders, so this can never drift from what was actually recorded as pending.
  // Returns null (a clean no-op, not a throw) when there's nothing to release: either order.paid
  // never posted (shouldn't happen for a real DELIVERED order, but this is reachable from a
  // delayed job with no other context to check against), or it posted with no SELLER_PENDING
  // entry at all (P7-04's own 100%-commission edge case, where that entry is omitted outright).
  async releasePendingForOrder(cmd: {
    orderId: string;
    sellerId: string;
  }): Promise<LedgerTransaction | null> {
    const paidTx = await this.ledger.findTransactionByIdempotencyKey(`order.paid:${cmd.orderId}`);
    const currency = paidTx?.entries[0]?.currency;
    if (!paidTx || currency === undefined) {
      return null;
    }

    const pendingAccount = await this.ledger.findAccount('SELLER_PENDING', cmd.sellerId, currency);
    const pendingEntry = pendingAccount
      ? paidTx.entries.find((entry) => entry.accountId === pendingAccount.id)
      : undefined;
    if (!pendingEntry) {
      return null;
    }

    return this.post({
      type: 'order.delivered',
      idempotencyKey: `order.delivered:${cmd.orderId}`,
      referenceType: 'order',
      referenceId: cmd.orderId,
      currency,
      entries: [
        {
          accountType: 'SELLER_PENDING',
          ownerId: cmd.sellerId,
          direction: 'DEBIT',
          amount: pendingEntry.amount,
        },
        {
          accountType: 'SELLER_AVAILABLE',
          ownerId: cmd.sellerId,
          direction: 'CREDIT',
          amount: pendingEntry.amount,
        },
      ],
    });
  }

  // Cheap pre-filter for `modules/payouts`: "which sellers even need considering this run,"
  // reading the cached projection rather than re-summing every seller's entries.
  async listSellersWithAvailableBalance(currency: string): Promise<readonly string[]> {
    return this.ledger.findSellersWithPositiveAvailableBalance(currency);
  }

  // The `(orderId, amount)` pairs `modules/payouts` needs to build a payout's `PayoutItem` rows
  // and statement — straight from the ledger's own entries, since `SellerBalance` has no
  // per-order breakdown to read instead.
  async listDeliveredOrderCredits(
    sellerId: string,
    currency: string,
  ): Promise<ReadonlyArray<{ orderId: string; amount: bigint }>> {
    return this.ledger.findDeliveredOrderCredits(sellerId, currency);
  }

  // Moved here from infra/jobs/reconcile.processor.ts in P8-06 — the logic only ever needed
  // `LedgerRepositoryPort`, an application-layer dependency, so the BullMQ job (infra) now calls
  // this method instead of the other way around (application importing infra would invert
  // AGENTS.md §4's dependency direction: "infra implements ports declared in domain/application").
  // Also exposed for `GET /admin/ledger/reconciliation` (05-API-SPEC.md §11), unowned until now.
  async getReconciliationReport(): Promise<ReconciliationReport> {
    // Check 1: every transaction balances — an independent, direct re-check of the exact
    // invariant buildLedgerTransaction() (P7-02) enforces at construction time, proving it in
    // the real live data rather than just trusting the write path was never bypassed.
    const unbalancedTransactionIds = await this.ledger.findUnbalancedTransactionIds();

    // Check 2: SellerBalance projections match entries — recomputes each field independently
    // from LedgerEntry (never trusts the cache) and compares, read-only. A mismatch is reported,
    // never silently repaired here — rebuildBalance() exists for that, and silently calling it
    // during reconciliation would mask the exact bug this check exists to surface.
    const sellerIds = await this.ledger.findSellerIdsWithBalance();
    const balanceMismatches: BalanceMismatch[] = [];
    for (const sellerId of sellerIds) {
      const cached = await this.ledger.findSellerBalance(sellerId);
      if (!cached) {
        continue;
      }

      const [pendingAmount, availableAmount, paidOutAmount] = await Promise.all([
        this.ledger.sumAccountEntries(sellerId, cached.currency, 'SELLER_PENDING'),
        this.ledger.sumAccountEntries(sellerId, cached.currency, 'SELLER_AVAILABLE'),
        this.ledger.sumAccountEntries(sellerId, cached.currency, 'SELLER_PAID_OUT'),
      ]);

      if (cached.pendingAmount !== pendingAmount) {
        balanceMismatches.push({
          sellerId,
          field: 'pendingAmount',
          cached: cached.pendingAmount,
          recomputed: pendingAmount,
        });
      }
      if (cached.availableAmount !== availableAmount) {
        balanceMismatches.push({
          sellerId,
          field: 'availableAmount',
          cached: cached.availableAmount,
          recomputed: availableAmount,
        });
      }
      if (cached.paidOutAmount !== paidOutAmount) {
        balanceMismatches.push({
          sellerId,
          field: 'paidOutAmount',
          cached: cached.paidOutAmount,
          recomputed: paidOutAmount,
        });
      }
    }

    // Check 3 (partial — see ReconciliationReport's own doc comment on cashCheck).
    // `sumAccountEntries` returns credit − debit, the correct sign for a liability-normal
    // account (SELLER_PENDING/AVAILABLE/PAID_OUT, where a credit is what's owed). PLATFORM_CASH
    // is asset-normal — it increases via DEBIT (03-DATA-MODEL.md §10's own "Order paid" example:
    // "DEBIT PLATFORM_CASH 10000" means cash came in) — so the sign is negated here to report a
    // real positive cash balance, not the liability-normal reading inverted.
    const ledgerCashBalance = -(await this.ledger.sumAccountEntries(null, 'USD', 'PLATFORM_CASH'));

    // Check 3 (complete, 3c): compare the ledger's own USD cash against the processor's real
    // wallet (Stripe balance: available + pending, the actual cash on hand). Since 3b the
    // ledger books the processor fee inline (the PROCESSOR_FEES debit / PLATFORM_CASH credit
    // pair on order.paid), so PLATFORM_CASH ends at Stripe's fee-net figure — Stripe's
    // balance is already net of its fees, and a clean ledger tracks processor cash exactly.
    // Deviations get reported, never silently absorbed — the reconciliation's whole point is
    // surfacing them. A Stripe failure propagates (the nightly job retries; the admin GET
    // surfaces the 503) rather than the report pretending the check passed.
    const processorBalances = await this.payments.getProcessorCashBalances();
    const usdProcessor = processorBalances.find((b) => b.currency === 'USD');
    const processorAvailableMinor = usdProcessor?.availableMinor ?? BigInt(0);
    const processorPendingMinor = usdProcessor?.pendingMinor ?? BigInt(0);
    const processorCashBalance = processorAvailableMinor + processorPendingMinor;
    const cashMatches = ledgerCashBalance === processorCashBalance;

    return {
      ok: unbalancedTransactionIds.length === 0 && balanceMismatches.length === 0 && cashMatches,
      unbalancedTransactionIds,
      sellersChecked: sellerIds.length,
      balanceMismatches,
      cashCheck: {
        status: cashMatches ? 'OK' : 'MISMATCH',
        ledgerCashBalance,
        processorAvailableMinor,
        processorPendingMinor,
        processorCashBalance,
      },
    };
  }

  private async resolveAccount(
    type: LedgerAccountType,
    ownerId: string | null,
    currency: string,
  ): Promise<LedgerAccount> {
    const existing = await this.ledger.findAccount(type, ownerId, currency);
    if (existing) {
      return existing;
    }
    return this.ledger.createAccount({ id: generateId(), type, ownerId, currency });
  }
}

export interface BalanceMismatch {
  readonly sellerId: string;
  readonly field: keyof SellerBalanceAmounts;
  readonly cached: bigint;
  readonly recomputed: bigint;
}

// The ledger's USD cash vs the processor's real wallet (03-DATA-MODEL.md §10's 3rd check,
// completed in 3c): since 3b the ledger books processor fees inline, so PLATFORM_CASH sits at
// Stripe's fee-net figure, matching the processor's fee-net balance exactly; any drift is
// reported as MISMATCH and flips report.ok.
// Stripe faults propagate — a check that cannot fetch the real side must not fake a pass.
export interface CashCheck {
  readonly status: 'OK' | 'MISMATCH';
  readonly ledgerCashBalance: bigint;
  readonly processorAvailableMinor: bigint;
  readonly processorPendingMinor: bigint;
  readonly processorCashBalance: bigint;
}

export interface ReconciliationReport {
  readonly ok: boolean;
  readonly unbalancedTransactionIds: readonly string[];
  readonly sellersChecked: number;
  readonly balanceMismatches: readonly BalanceMismatch[];
  readonly cashCheck: CashCheck;
}
