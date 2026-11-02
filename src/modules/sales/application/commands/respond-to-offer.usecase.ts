import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { Clock, CLOCK } from '../../../../shared/time/clock';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { RateLimitService } from '../../../../platform/rate-limit/rate-limit.service';
import { SALE_REPOSITORY, SaleRepositoryPort } from '../../domain/ports/sale.repository.port';
import { OFFER_REPOSITORY, OfferRepositoryPort } from '../../domain/ports/offer.repository.port';
import { OfferStatus } from '../../domain/entities/offer.entity';
import {
  OfferExpiredError,
  OfferNotFoundError,
  OfferRateLimitedError,
  SaleNotOpenError,
} from '../../domain/errors/sales.errors';
import { offerRespondedEvent } from '../../events/published/offer-responded.event';
import { saleResolvedEvent } from '../../events/published/sale-resolved.event';
import { SellersService } from '../../../sellers/application/sellers.service';
import { OrdersService } from '../../../orders/application/orders.service';
import { TransactionManager } from '../../../../platform/database/transaction.manager';

export type RespondToOfferCommand =
  | { readonly offerId: string; readonly respondingUserId: string; readonly action: 'ACCEPT' }
  | { readonly offerId: string; readonly respondingUserId: string; readonly action: 'REJECT' }
  | {
      readonly offerId: string;
      readonly respondingUserId: string;
      readonly action: 'COUNTER';
      readonly counterAmount: bigint;
    };

export interface RespondToOfferResult {
  readonly offerId: string;
  readonly status: OfferStatus;
  readonly counterAmount: bigint | null;
}

@Injectable()
export class RespondToOfferUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly sales: SaleRepositoryPort,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly sellers: SellersService,
    private readonly rateLimit: RateLimitService,
    private readonly tx: TransactionManager,
    private readonly orders: OrdersService,
  ) {}

  async execute(
    cmd: RespondToOfferCommand,
  ): Promise<
    Result<RespondToOfferResult, OfferNotFoundError | OfferExpiredError | SaleNotOpenError | OfferRateLimitedError>
  > {
    // 05-API-SPEC.md §13: "Offer: 2/sec per user" — same shared scope submit-offer checks,
    // keyed on the responding seller rather than the buyer.
    const limit = await this.rateLimit.check('offer', cmd.respondingUserId);
    if (!limit.allowed) {
      return Err(new OfferRateLimitedError(limit.retryAfterSeconds));
    }

    const offer = await this.offers.findById(cmd.offerId);
    if (!offer) {
      return Err(new OfferNotFoundError(cmd.offerId));
    }

    const sale = await this.sales.findById(offer.saleId);
    // Offer.saleId is a real FK (onDelete: Cascade) — a miss here would mean the Sale was
    // deleted out from under a live Offer, which nothing in this codebase ever does.
    if (!sale) {
      throw new Error(`Offer ${offer.id} references sale ${offer.saleId}, which does not exist`);
    }

    // Sale.sellerId is a Seller.id, not a User.id (see guard-not-seller.ts) — resolve the
    // responder's own seller profile and compare ids, same translation place-bid/buy-now/
    // submit-offer all need. 404, not 403, either way: a non-seller and a seller who just
    // doesn't own this sale both look identical to an unauthorized caller (catalog's
    // established precedent, P3-02).
    const responderSeller = await this.sellers.getMySeller({ userId: cmd.respondingUserId });
    if (!responderSeller.ok || responderSeller.value.seller.id !== sale.sellerId) {
      return Err(new OfferNotFoundError(cmd.offerId));
    }

    const now = this.clock.now();
    if (offer.status !== 'PENDING' || now >= offer.expiresAt) {
      return Err(new OfferExpiredError(cmd.offerId));
    }

    if (cmd.action === 'ACCEPT') {
      // Resolve the sale FIRST: if this fails (a genuine race — the sale stopped being OPEN
      // through some other path), the offer is left untouched at PENDING rather than marked
      // ACCEPTED against a sale that was never actually won.
      // Sale, stock and order commit together (see BuyNowUseCase). A failed order leaves the offer
      // at PENDING and the sale OPEN.
      const won = await this.tx.run(async (trx) => {
        const resolvedSale = await this.sales.resolveOpenToResolved(
          sale.id,
          { winnerUserId: offer.userId, finalAmount: offer.amount, resolvedAt: now },
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
          buyerUserId: offer.userId,
          finalAmount: offer.amount,
        });
        return true;
      });
      if (!won) {
        return Err(new SaleNotOpenError(sale.id, 'RESOLVED'));
      }

      // Secondary bookkeeping — the sale's own resolution above is the authoritative outcome.
      // A failure here (the offer no longer PENDING, an extreme same-second double-click race)
      // doesn't change that the sale was genuinely won; not treated as a blocking error.
      await this.offers.respond(offer.id, { status: 'ACCEPTED', counterAmount: null, respondedAt: now });

      await this.eventBus.publish(
        offerRespondedEvent({ offerId: offer.id, saleId: sale.id, buyerUserId: offer.userId, status: 'ACCEPTED', counterAmount: null }),
      );
      await this.eventBus.publish(
        saleResolvedEvent({
          saleId: sale.id,
          sessionId: sale.sessionId,
          sellerId: sale.sellerId,
          productId: sale.productId,
          mode: sale.mode,
          currency: sale.currency,
          winnerUserId: offer.userId,
          finalAmount: offer.amount.toString(),
          quantity: sale.quantity,
          resolvedAt: now.toISOString(),
        }),
      );

      return Ok({ offerId: offer.id, status: 'ACCEPTED', counterAmount: null });
    }

    const status: OfferStatus = cmd.action === 'REJECT' ? 'REJECTED' : 'COUNTERED';
    const counterAmount = cmd.action === 'COUNTER' ? cmd.counterAmount : null;

    const responded = await this.offers.respond(offer.id, { status, counterAmount, respondedAt: now });
    if (!responded) {
      return Err(new OfferExpiredError(cmd.offerId));
    }

    await this.eventBus.publish(
      offerRespondedEvent({
        offerId: offer.id,
        saleId: sale.id,
        buyerUserId: offer.userId,
        status,
        counterAmount: counterAmount !== null ? counterAmount.toString() : null,
      }),
    );

    return Ok({ offerId: offer.id, status, counterAmount });
  }
}
