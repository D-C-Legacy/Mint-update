import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { Clock, CLOCK } from '../../../../shared/time/clock';
import { generateId } from '../../../../shared/ids/id';
import { TransactionManager } from '../../../../platform/database/transaction.manager';
import { QueueService } from '../../../../platform/queue/queue.service';
import { QueueNames } from '../../../../platform/queue/queue.names';
import { RateLimitService } from '../../../../platform/rate-limit/rate-limit.service';
import { bidLatencyHistogram } from '../../../../platform/observability/metrics';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { salesConfig } from '../../../../config/sales.config';
import { SALE_REPOSITORY, SaleRepositoryPort } from '../../domain/ports/sale.repository.port';
import { BID_REPOSITORY, BidRepositoryPort } from '../../domain/ports/bid.repository.port';
import { AuctionEntity, AuctionRules, AuctionSnapshot, BidRejection } from '../../domain/entities/auction.entity';
import { BidBySellerError, BidRateLimitedError, SaleNotFoundError } from '../../domain/errors/sales.errors';
import { bidAcceptedEvent } from '../../events/published/bid-accepted.event';
import { SellersService } from '../../../sellers/application/sellers.service';
import { guardNotSeller } from '../guard-not-seller';

export interface PlaceBidCommand {
  readonly saleId: string;
  readonly bidderUserId: string;
  readonly amount: bigint;
  readonly clientRef: string;
}

export interface PlaceBidResult {
  readonly bidId: string;
  readonly amount: bigint;
  readonly endsAt: Date;
  readonly extended: boolean;
  readonly serverNow: Date;
}

export const AUCTION_CLOSE_JOB = 'auction.close';

// 06-REALTIME-AND-CONCURRENCY.md §6 writes this as `close:${saleId}`, but BullMQ 5.x rejects
// colons in custom job ids ("Custom Id cannot contain :") — found live, not from reading the
// doc. A hyphen is the closest valid equivalent; P5-07's close job and sweeper must construct
// this exact same id to find/replace it.
export function auctionCloseJobId(saleId: string): string {
  return `close-${saleId}`;
}

interface TransactionOutcome {
  readonly bidId: string;
  readonly sequence: number;
  readonly sessionId: string;
  readonly extended: boolean;
  readonly newEndsAt: Date;
  readonly extensionCount: number;
  readonly previousLeaderUserId: string | null;
}

@Injectable()
export class PlaceBidUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly sales: SaleRepositoryPort,
    @Inject(BID_REPOSITORY) private readonly bids: BidRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly tx: TransactionManager,
    private readonly queue: QueueService,
    private readonly sellers: SellersService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async execute(
    cmd: PlaceBidCommand,
  ): Promise<Result<PlaceBidResult, SaleNotFoundError | BidBySellerError | BidRejection | BidRateLimitedError>> {
    // 05-API-SPEC.md §13: 5/sec per user — checked once here so both transports (the HTTP
    // controller and the WS gateway, which both call this same use case) share one bucket.
    const limit = await this.rateLimit.check('bid', cmd.bidderUserId);
    if (!limit.allowed) {
      return Err(new BidRateLimitedError(limit.retryAfterSeconds));
    }

    const now = this.clock.now();

    // 1-3: lock, validate, persist — all inside one transaction (06-REALTIME-AND-CONCURRENCY.md §4).
    // 02-TRD.md §8's "bid validate and persist, p95 < 40ms" budget maps exactly to this block —
    // not the rate-limit check above it, not the post-commit job/event-publish below it.
    const stopTimer = bidLatencyHistogram.startTimer();
    const outcome = await this.tx
      .run<Result<TransactionOutcome, SaleNotFoundError | BidBySellerError | BidRejection>>(async (trx) => {
        const sale = await this.sales.lockForUpdate(trx, cmd.saleId);
        if (!sale) {
          return Err(new SaleNotFoundError(cmd.saleId));
        }

        // This use case only ever serves AUCTION-mode sales — BUY_NOW/OFFER have their own
        // use cases (P5-08) and never populate startAmount/endsAt. A mismatch here is a
        // routing bug upstream, not a user-reachable rejection, so it throws rather than
        // returning a domain error.
        if (sale.mode !== 'AUCTION' || sale.startAmount === null || sale.endsAt === null) {
          throw new Error(`Sale ${sale.id} is not a valid open auction (mode: ${sale.mode})`);
        }

        // Sale.sellerId is a Seller.id, not a User.id — see guard-not-seller.ts for why this
        // can't be a plain field comparison inside the pure entity.
        const notSeller = await guardNotSeller(this.sellers, cmd.bidderUserId, sale.id, sale.sellerId);
        if (!notSeller.ok) {
          return Err(notSeller.error);
        }

        const leadingBid = sale.currentBidId ? await this.bids.findById(sale.currentBidId) : null;

        const snapshot: AuctionSnapshot = {
          id: sale.id,
          status: sale.status,
          currentAmount: sale.currentAmount,
          startAmount: sale.startAmount,
          endsAt: sale.endsAt,
          extensionCount: sale.extensionCount,
          currentLeaderUserId: leadingBid?.userId ?? null,
        };

        const rules: AuctionRules = {
          incrementBands: salesConfig.bidIncrementBands,
          antiSnipe: salesConfig.antiSnipe,
        };

        const decision = AuctionEntity.from(snapshot).evaluateBid(
          { amount: cmd.amount, bidderUserId: cmd.bidderUserId, now },
          rules,
        );
        if (!decision.ok) {
          return Err(decision.error);
        }

        const bid = await this.bids.create(trx, {
          id: generateId(),
          saleId: sale.id,
          userId: cmd.bidderUserId,
          amount: cmd.amount,
        });

        const updatedSale = await this.sales.applyBid(trx, sale.id, {
          currentAmount: cmd.amount,
          currentBidId: bid.id,
          endsAt: decision.value.newEndsAt,
          extended: decision.value.shouldExtend,
        });

        return Ok({
          bidId: bid.id,
          sequence: bid.sequence,
          sessionId: sale.sessionId,
          extended: decision.value.shouldExtend,
          newEndsAt: decision.value.newEndsAt,
          extensionCount: updatedSale.extensionCount,
          previousLeaderUserId: snapshot.currentLeaderUserId,
        });
      })
      .finally(() => stopTimer());

    if (!outcome.ok) {
      return outcome;
    }

    // 4: AFTER commit — reschedule the close job, then publish fanout. Never before: a rolled
    // back transaction that already broadcast would leave clients in a state that never happened.
    const { bidId, sequence, sessionId, extended, newEndsAt, extensionCount, previousLeaderUserId } =
      outcome.value;

    if (extended) {
      const jobId = auctionCloseJobId(cmd.saleId);
      await this.queue.remove(QueueNames.SALES, jobId);
      await this.queue.schedule(
        QueueNames.SALES,
        AUCTION_CLOSE_JOB,
        { saleId: cmd.saleId },
        Math.max(0, newEndsAt.getTime() - this.clock.now().getTime()),
        jobId,
      );
    }

    await this.eventBus.publish(
      bidAcceptedEvent({
        saleId: cmd.saleId,
        sessionId,
        bidId,
        bidderUserId: cmd.bidderUserId,
        clientRef: cmd.clientRef,
        amount: cmd.amount.toString(),
        sequence,
        endsAt: newEndsAt.toISOString(),
        extended,
        extensionCount,
        previousLeaderUserId,
      }),
    );

    return Ok({
      bidId,
      amount: cmd.amount,
      endsAt: newEndsAt,
      extended,
      serverNow: this.clock.now(),
    });
  }
}
