import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { Clock, CLOCK } from '../../../../shared/time/clock';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { SALE_REPOSITORY, SaleRepositoryPort } from '../../domain/ports/sale.repository.port';
import { BidBySellerError, SaleNotFoundError, SaleNotOpenError } from '../../domain/errors/sales.errors';
import { saleResolvedEvent } from '../../events/published/sale-resolved.event';
import { SellersService } from '../../../sellers/application/sellers.service';
import { OrdersService } from '../../../orders/application/orders.service';
import { TransactionManager } from '../../../../platform/database/transaction.manager';
import { guardNotSeller } from '../guard-not-seller';

export interface BuyNowCommand {
  readonly saleId: string;
  readonly buyerUserId: string;
  readonly clientRef: string;
}

export interface BuyNowResult {
  readonly saleId: string;
  readonly finalAmount: bigint;
  readonly quantity: number;
}

@Injectable()
export class BuyNowUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly sales: SaleRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly sellers: SellersService,
    private readonly tx: TransactionManager,
    private readonly orders: OrdersService,
  ) {}

  async execute(
    cmd: BuyNowCommand,
  ): Promise<Result<BuyNowResult, SaleNotFoundError | SaleNotOpenError | BidBySellerError>> {
    const sale = await this.sales.findById(cmd.saleId);
    if (!sale) {
      return Err(new SaleNotFoundError(cmd.saleId));
    }

    // This use case only ever serves BUY_NOW-mode sales — AUCTION/OFFER have their own use
    // cases and never populate `price`. A mismatch here is a routing bug, not a user-reachable
    // rejection.
    if (sale.mode !== 'BUY_NOW' || sale.price === null) {
      throw new Error(`Sale ${sale.id} is not a valid buy-now listing (mode: ${sale.mode})`);
    }

    if (sale.status !== 'OPEN') {
      return Err(new SaleNotOpenError(sale.id, sale.status));
    }

    const notSeller = await guardNotSeller(this.sellers, cmd.buyerUserId, sale.id, sale.sellerId);
    if (!notSeller.ok) {
      return Err(notSeller.error);
    }

    // No reserveStock call here (removed in P6-02, real bug fix — see MEMORY.md): P5-09 already
    // reserves `sale.quantity` units for this exact sale at creation time, for every mode. This
    // use case used to reserve *again* at buy-time, a leftover from before P5-09 existed, when
    // stock contention was this use case's only way to decide a winner (06-REALTIME-AND-
    // CONCURRENCY.md §7). That's now double-booking — the one reservation already held by this
    // Sale is the only one that should ever exist for it. `resolveOpenToResolved`'s own atomic
    // OPEN→RESOLVED guard is sufficient and exclusive on its own to pick exactly one winner when
    // two buyers race the same sale, exactly like respond-to-offer's ACCEPT path already does.
    const now = this.clock.now();
    const finalAmount = sale.price * BigInt(sale.quantity);

    // The sale, its stock and its order commit together, or none of them do: a failed order rolls
    // the purchase back, so the buyer never sees a failure for a sale that has already resolved.
    // The sale.resolved event is published only after that commit.
    const won = await this.tx.run(async (trx) => {
      const resolvedSale = await this.sales.resolveOpenToResolved(
        sale.id,
        { winnerUserId: cmd.buyerUserId, finalAmount, resolvedAt: now },
        trx,
      );
      if (!resolvedSale) return false;
      await this.orders.createFromSale({
        trx,
        saleId: sale.id,
        sellerId: sale.sellerId,
        productId: sale.productId,
        quantity: sale.quantity,
        currency: sale.currency,
        buyerUserId: cmd.buyerUserId,
        finalAmount,
      });
      return true;
    });

    if (!won) {
      // Someone else resolved this sale first. Nothing was changed, because this transaction only
      // resolved the sale when it was still OPEN.
      return Err(new SaleNotOpenError(sale.id, 'RESOLVED'));
    }

    await this.eventBus.publish(
      saleResolvedEvent({
        saleId: sale.id,
        sessionId: sale.sessionId,
        sellerId: sale.sellerId,
        productId: sale.productId,
        mode: sale.mode,
        currency: sale.currency,
        winnerUserId: cmd.buyerUserId,
        finalAmount: finalAmount.toString(),
        quantity: sale.quantity,
        resolvedAt: now.toISOString(),
      }),
    );

    return Ok({ saleId: sale.id, finalAmount, quantity: sale.quantity });
  }
}
