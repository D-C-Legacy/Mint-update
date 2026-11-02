import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { Clock, CLOCK } from '../../../../shared/time/clock';
import { TransactionManager } from '../../../../platform/database/transaction.manager';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { SALE_REPOSITORY, SaleRepositoryPort } from '../../domain/ports/sale.repository.port';
import { BID_REPOSITORY, BidRepositoryPort } from '../../domain/ports/bid.repository.port';
import { Sale, SaleMode } from '../../domain/entities/sale.entity';
import { SaleNotFoundError } from '../../domain/errors/sales.errors';
import { saleResolvedEvent } from '../../events/published/sale-resolved.event';
import { saleCancelledEvent } from '../../events/published/sale-cancelled.event';
import { CatalogService } from '../../../catalog/application/catalog.service';
import { OrdersService } from '../../../orders/application/orders.service';

export interface CloseAuctionCommand {
  readonly saleId: string;
}

export type CloseAuctionOutcome = 'ALREADY_CLOSED' | 'EXPIRED' | 'RESOLVED';

export interface CloseAuctionResult {
  readonly saleId: string;
  readonly outcome: CloseAuctionOutcome;
  readonly winnerUserId: string | null;
  readonly finalAmount: bigint | null;
}

type CloseOutcome =
  | { readonly kind: 'noop'; readonly sale: Sale }
  | { readonly kind: 'expired'; readonly saleId: string; readonly sessionId: string; readonly productId: string; readonly quantity: number }
  | {
      readonly kind: 'resolved';
      readonly saleId: string;
      readonly sessionId: string;
      readonly sellerId: string;
      readonly productId: string;
      readonly mode: SaleMode;
      readonly currency: string;
      readonly winnerUserId: string;
      readonly finalAmount: bigint;
      readonly quantity: number;
    };

@Injectable()
export class CloseAuctionUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly sales: SaleRepositoryPort,
    @Inject(BID_REPOSITORY) private readonly bids: BidRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly tx: TransactionManager,
    private readonly catalog: CatalogService,
    private readonly orders: OrdersService,
  ) {}

  async execute(cmd: CloseAuctionCommand): Promise<Result<CloseAuctionResult, SaleNotFoundError>> {
    const now = this.clock.now();

    // 1-3: lock, idempotent-no-op check, resolve — all inside one transaction. A single final
    // write (not a separate durable CLOSING write first) is deliberate: everything here is
    // already invisible to every other reader until commit, so a crash mid-way just rolls back
    // to OPEN and the next job/sweeper attempt starts clean, rather than risking a sale stuck
    // forever in CLOSING if the process died between two separate commits.
    const outcome = await this.tx.run<Result<CloseOutcome, SaleNotFoundError>>(async (trx) => {
      const sale = await this.sales.lockForUpdate(trx, cmd.saleId);
      if (!sale) {
        return Err(new SaleNotFoundError(cmd.saleId));
      }

      if (sale.status !== 'OPEN') {
        return Ok({ kind: 'noop', sale });
      }

      // The close job/sweeper only ever targets rows with endsAt set (the sweeper's own query
      // excludes NULL endsAt), so a non-AUCTION sale reaching here would be a routing bug.
      if (sale.mode !== 'AUCTION') {
        throw new Error(`Sale ${sale.id} is not an auction (mode: ${sale.mode})`);
      }

      if (sale.currentBidId === null) {
        await this.sales.resolveToExpired(trx, sale.id, now);
        return Ok({ kind: 'expired', saleId: sale.id, sessionId: sale.sessionId, productId: sale.productId, quantity: sale.quantity });
      }

      const winningBid = await this.bids.findById(sale.currentBidId);
      if (!winningBid) {
        // place-bid always creates the Bid before pointing Sale.currentBidId at it, in the
        // same transaction — a miss here would be a real data-integrity bug, not a timing race.
        throw new Error(`Sale ${sale.id} has currentBidId ${sale.currentBidId} but no such Bid exists`);
      }

      await this.sales.resolveToResolved(trx, sale.id, {
        winnerUserId: winningBid.userId,
        finalAmount: winningBid.amount,
        resolvedAt: now,
      });
      // Same transaction as the resolution (see BuyNowUseCase): a failed order rolls the close back,
      // and the sweeper retries it.
      await this.orders.createFromSale({
        trx,
        saleId: sale.id,
        sellerId: sale.sellerId,
        productId: sale.productId,
        quantity: sale.quantity,
        currency: sale.currency,
        buyerUserId: winningBid.userId,
        finalAmount: winningBid.amount,
      });

      return Ok({
        kind: 'resolved',
        saleId: sale.id,
        sessionId: sale.sessionId,
        sellerId: sale.sellerId,
        productId: sale.productId,
        mode: sale.mode,
        currency: sale.currency,
        winnerUserId: winningBid.userId,
        finalAmount: winningBid.amount,
        quantity: sale.quantity,
      });
    });

    if (!outcome.ok) {
      return outcome;
    }

    // 4: AFTER commit — never publish before, a rolled-back close must not have broadcast.
    const result = outcome.value;

    if (result.kind === 'noop') {
      return Ok({
        saleId: result.sale.id,
        outcome: 'ALREADY_CLOSED',
        winnerUserId: result.sale.winnerUserId,
        finalAmount: result.sale.finalAmount,
      });
    }

    if (result.kind === 'expired') {
      // Known, pre-existing gap (not caused by this ticket): no ticket yet reserves stock when
      // an AUCTION sale opens (03-DATA-MODEL.md §4 says it should — "reserved increments when a
      // sale opens"), so this release can legitimately find nothing reserved and fail. The
      // sale's own close must never be blocked by an inventory reconciliation issue, so the
      // result is intentionally not checked — flagged in PROGRESS/MEMORY, not silently assumed.
      await this.catalog.releaseStock({ productId: result.productId, qty: result.quantity });

      await this.eventBus.publish(
        saleCancelledEvent({
          saleId: result.saleId,
          sessionId: result.sessionId,
          reason: 'EXPIRED_NO_BIDS',
          resolvedAt: now.toISOString(),
        }),
      );

      return Ok({ saleId: result.saleId, outcome: 'EXPIRED', winnerUserId: null, finalAmount: null });
    }

    await this.eventBus.publish(
      saleResolvedEvent({
        saleId: result.saleId,
        sessionId: result.sessionId,
        sellerId: result.sellerId,
        productId: result.productId,
        mode: result.mode,
        currency: result.currency,
        winnerUserId: result.winnerUserId,
        finalAmount: result.finalAmount.toString(),
        quantity: result.quantity,
        resolvedAt: now.toISOString(),
      }),
    );

    return Ok({
      saleId: result.saleId,
      outcome: 'RESOLVED',
      winnerUserId: result.winnerUserId,
      finalAmount: result.finalAmount,
    });
  }
}
