import type { TransactionClient } from '../../../../platform/database/transaction.manager';
import { Bid } from '../entities/bid.entity';

export const BID_REPOSITORY = Symbol('BidRepositoryPort');

export interface CreateBidInput {
  readonly id: string;
  readonly saleId: string;
  readonly userId: string;
  readonly amount: bigint;
}

export interface ListBidsFilter {
  readonly saleId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface ListMyBidsFilter {
  readonly userId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface BidRepositoryPort {
  findById(id: string): Promise<Bid | null>;
  /** The buyer's own bids across all sales, most recent first (GET /v1/me/bids). */
  findByUserId(filter: ListMyBidsFilter): Promise<Bid[]>;
  /** Inserts within the given transaction, auto-assigning the next strictly increasing
   *  `sequence` for this sale (`MAX(sequence)+1`) — safe only because the Sale row is locked
   *  for the lifetime of this same transaction (see SaleRepositoryPort.lockForUpdate). The
   *  leading bidder's userId (for AuctionSnapshot.currentLeaderUserId) is resolved by the
   *  caller via `findById(sale.currentBidId)`, not a separate method here. */
  create(trx: TransactionClient, input: CreateBidInput): Promise<Bid>;
  /** Most recent first (GET /sales/:id/bids, 05-API-SPEC.md §7). */
  findBySaleId(filter: ListBidsFilter): Promise<Bid[]>;
}
