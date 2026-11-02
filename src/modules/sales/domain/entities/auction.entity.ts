import { Result, Ok, Err } from '../../../../shared/result/result';
import { IncrementBand, minimumNextBid } from '../rules/increment.rule';
import { AntiSnipeConfig, evaluateAntiSnipe } from '../rules/anti-snipe.rule';
import { BidderAlreadyLeadingError, BidTooLowError, SaleEndedError, SaleNotOpenError } from '../errors/sales.errors';
import { SaleStatus } from './sale.entity';

export interface AuctionSnapshot {
  readonly id: string;
  readonly status: SaleStatus;
  readonly currentAmount: bigint | null; // null until the first bid; startAmount is the anchor until then
  readonly startAmount: bigint;
  readonly endsAt: Date;
  readonly extensionCount: number;
  // Not a Sale column — Sale only stores currentBidId. The caller resolves this from the
  // leading Bid's userId (via a join) before building this snapshot.
  readonly currentLeaderUserId: string | null;
}

export interface PlaceBidInput {
  readonly amount: bigint;
  readonly bidderUserId: string;
  readonly now: Date;
}

export interface AuctionRules {
  readonly incrementBands: readonly IncrementBand[];
  readonly antiSnipe: AntiSnipeConfig;
}

export interface BidAccepted {
  readonly shouldExtend: boolean;
  readonly newEndsAt: Date;
}

// BID_BY_SELLER is deliberately not this entity's job (06-REALTIME-AND-CONCURRENCY.md §4's
// pseudocode suggests it is, but Sale.sellerId is a Seller.id, not the acting User.id, and
// resolving that requires a cross-module SellersService call — I/O this pure entity must not
// do). The caller resolves it instead, via `guardNotSeller()`, before ever constructing a
// snapshot. See MEMORY.md for the full story — this was a real bug through P5-06.
export type BidRejection = SaleNotOpenError | SaleEndedError | BidderAlreadyLeadingError | BidTooLowError;

export class AuctionEntity {
  private constructor(private readonly snapshot: AuctionSnapshot) {}

  static from(snapshot: AuctionSnapshot): AuctionEntity {
    return new AuctionEntity(snapshot);
  }

  evaluateBid(input: PlaceBidInput, rules: AuctionRules): Result<BidAccepted, BidRejection> {
    const sale = this.snapshot;

    if (sale.status !== 'OPEN') {
      return Err(new SaleNotOpenError(sale.id, sale.status));
    }

    // Belt and braces alongside P5-07's scheduled job + sweeper (06-REALTIME-AND-CONCURRENCY.md
    // §6): a bid can race in after endsAt but before either mechanism has closed the sale.
    if (input.now >= sale.endsAt) {
      return Err(new SaleEndedError(sale.id, sale.endsAt));
    }

    if (sale.currentLeaderUserId !== null && input.bidderUserId === sale.currentLeaderUserId) {
      return Err(new BidderAlreadyLeadingError(sale.id));
    }

    const currentPrice = sale.currentAmount ?? sale.startAmount;
    const minimumNext = minimumNextBid(currentPrice, rules.incrementBands);

    if (input.amount < minimumNext) {
      return Err(new BidTooLowError(sale.id, minimumNext, currentPrice));
    }

    const antiSnipe = evaluateAntiSnipe(input.now, sale.endsAt, sale.extensionCount, rules.antiSnipe);

    return Ok({ shouldExtend: antiSnipe.shouldExtend, newEndsAt: antiSnipe.newEndsAt });
  }
}
