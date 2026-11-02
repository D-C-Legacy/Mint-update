import type { TransactionClient } from '../../../../platform/database/transaction.manager';
import { Sale, SaleMode, SaleStatus } from '../entities/sale.entity';

export const SALE_REPOSITORY = Symbol('SaleRepositoryPort');

export interface CreateSaleInput {
  readonly id: string;
  readonly sessionId: string;
  readonly sellerId: string;
  readonly productId: string;
  readonly mode: SaleMode;
  readonly currency: string;
  readonly startAmount: bigint | null;
  readonly endsAt: Date | null;
  readonly price: bigint | null;
  readonly quantity: number;
}

export interface ApplyBidInput {
  readonly currentAmount: bigint;
  readonly currentBidId: string;
  readonly endsAt: Date;
  readonly extended: boolean;
}

// Mode switch keeps the same Sale row and its bids (founder decision, 14 Oct 2026,
// founder_requests.md §1) — this is an update of the mode-specific fields, not a new row.
// Auction-only fields (currentAmount/currentBidId/extensionCount) are deliberately left alone:
// switching OUT of auction doesn't erase bidding history, and switching back INTO it resumes
// from whatever was already there rather than resetting to startAmount.
export type SwitchModeInput =
  | { readonly mode: 'BUY_NOW'; readonly price: bigint; readonly quantity: number }
  | { readonly mode: 'AUCTION'; readonly startAmount: bigint; readonly endsAt: Date }
  | { readonly mode: 'OFFER' };

export interface ResolveToResolvedInput {
  readonly winnerUserId: string;
  readonly finalAmount: bigint;
  readonly resolvedAt: Date;
}

export interface ListPublicSalesFilter {
  readonly mode: SaleMode | undefined;
  readonly productId: string | undefined;
  readonly status: SaleStatus;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface ListSessionPurchasesFilter {
  readonly sessionId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface SaleRepositoryPort {
  findById(id: string): Promise<Sale | null>;
  /** Public sale directory (GET /v1/sales), filtered by status and optionally mode. Newest first. */
  listPublic(filter: ListPublicSalesFilter): Promise<Sale[]>;
  create(input: CreateSaleInput): Promise<Sale>;
  /** `SELECT ... FOR UPDATE`. Must be called inside a `TransactionManager.run()` callback —
   *  the lock is held for that transaction's lifetime, serializing concurrent bids on the
   *  same sale (06-REALTIME-AND-CONCURRENCY.md §4, ADR-003: row-locked, not Redis Lua). Bids
   *  on other sales are unaffected. Null if the sale doesn't exist. */
  lockForUpdate(trx: TransactionClient, id: string): Promise<Sale | null>;
  /** Applies an accepted bid's effect within the same transaction as the lock above:
   *  currentAmount/currentBidId/endsAt set, extensionCount +1 only if `extended`, version +1
   *  always (optimistic-concurrency guard per 03-DATA-MODEL.md §7). */
  applyBid(trx: TransactionClient, id: string, input: ApplyBidInput): Promise<Sale>;
  /** Mode switch (founder_requests.md §1). Must be called inside the same locked transaction as
   *  the OPEN-status check that led here — same safety requirement as applyBid, since a switch
   *  racing a concurrent bid is exactly the kind of interleaving 06-REALTIME-AND-CONCURRENCY.md §4
   *  exists to prevent. Bumps version like every other sale mutation. */
  switchMode(trx: TransactionClient, id: string, input: SwitchModeInput): Promise<Sale>;
  /** Auction closed with no bids. Must run inside the same locked transaction as the status
   *  check that led here (06-REALTIME-AND-CONCURRENCY.md §6 close sequence). */
  resolveToExpired(trx: TransactionClient, id: string, resolvedAt: Date): Promise<Sale>;
  /** Auction closed with a winner. Must run inside the same locked transaction as the status
   *  check that led here. */
  resolveToResolved(
    trx: TransactionClient,
    id: string,
    input: ResolveToResolvedInput,
  ): Promise<Sale>;
  /** `WHERE status = 'OPEN' AND endsAt < now() LIMIT limit` — the 10s sweeper's backup query
   *  (06-REALTIME-AND-CONCURRENCY.md §6), catching anything the scheduled close job missed. */
  findExpiredOpen(limit: number): Promise<Sale[]>;
  /** Atomic, conditional on current status being OPEN (`UPDATE ... WHERE status = 'OPEN'`) —
   *  no row lock needed (06-REALTIME-AND-CONCURRENCY.md §7: buy-now's concurrency is won at
   *  the Product reservation; this just guards against two reservations that both legitimately
   *  succeeded from both resolving the same Sale). Null if the sale was no longer OPEN — the
   *  caller must then roll back whatever it already reserved. Used by buy-now and offer-accept. */
  resolveOpenToResolved(
    id: string,
    input: ResolveToResolvedInput,
    trx?: TransactionClient,
  ): Promise<Sale | null>;
  /** Atomic, conditional on current status being OPEN. Null if it no longer was. Reuses
   *  `resolvedAt` generically as "when this sale stopped being open" (no separate
   *  `cancelledAt` column exists), same as `resolveToExpired` does for EXPIRED. */
  cancelOpen(id: string, cancelledAt: Date): Promise<Sale | null>;
  /** Resolved sales for a stream session, newest first (GET /v1/streams/:sessionId/purchases).
   *  Returns only RESOLVED sales. Cursor paginated by id descending. */
  listBySessionId(filter: ListSessionPurchasesFilter): Promise<Sale[]>;
  /** For StreamSession.itemsSold/grossAmount, finalized when a session ends (streaming module's
   *  SessionStatsFinalizer). "Sold" means `orderId IS NOT NULL` — a sale that actually produced
   *  a real order — rather than trusting `status = 'RESOLVED'` alone, which also covers an
   *  auction that resolved with no winner (no order, nothing sold). */
  getSessionSalesStats(sessionId: string): Promise<SessionSalesStats>;
}

export interface SessionSalesStats {
  readonly itemsSold: number;
  readonly grossAmount: bigint;
}
