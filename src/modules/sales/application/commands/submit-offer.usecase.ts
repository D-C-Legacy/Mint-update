import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { Clock, CLOCK } from '../../../../shared/time/clock';
import { generateId } from '../../../../shared/ids/id';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { RateLimitService } from '../../../../platform/rate-limit/rate-limit.service';
import { salesConfig } from '../../../../config/sales.config';
import { SALE_REPOSITORY, SaleRepositoryPort } from '../../domain/ports/sale.repository.port';
import { OFFER_REPOSITORY, OfferRepositoryPort } from '../../domain/ports/offer.repository.port';
import {
  BidBySellerError,
  OfferRateLimitedError,
  SaleNotFoundError,
  SaleNotOpenError,
} from '../../domain/errors/sales.errors';
import { offerSubmittedEvent } from '../../events/published/offer-submitted.event';
import { SellersService } from '../../../sellers/application/sellers.service';
import { guardNotSeller } from '../guard-not-seller';

export interface SubmitOfferCommand {
  readonly saleId: string;
  readonly buyerUserId: string;
  readonly amount: bigint;
  readonly clientRef: string;
}

export interface SubmitOfferResult {
  readonly offerId: string;
  readonly amount: bigint;
  readonly expiresAt: Date;
}

@Injectable()
export class SubmitOfferUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly sales: SaleRepositoryPort,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly sellers: SellersService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async execute(
    cmd: SubmitOfferCommand,
  ): Promise<
    Result<SubmitOfferResult, SaleNotFoundError | SaleNotOpenError | BidBySellerError | OfferRateLimitedError>
  > {
    // 05-API-SPEC.md §13: "Offer: 2/sec per user" — same shared scope respond-to-offer checks.
    const limit = await this.rateLimit.check('offer', cmd.buyerUserId);
    if (!limit.allowed) {
      return Err(new OfferRateLimitedError(limit.retryAfterSeconds));
    }

    const sale = await this.sales.findById(cmd.saleId);
    if (!sale) {
      return Err(new SaleNotFoundError(cmd.saleId));
    }

    if (sale.mode !== 'OFFER') {
      throw new Error(`Sale ${sale.id} is not an offer-mode listing (mode: ${sale.mode})`);
    }

    if (sale.status !== 'OPEN') {
      return Err(new SaleNotOpenError(sale.id, sale.status));
    }

    const notSeller = await guardNotSeller(this.sellers, cmd.buyerUserId, sale.id, sale.sellerId);
    if (!notSeller.ok) {
      return Err(notSeller.error);
    }

    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + salesConfig.offerExpirySeconds * 1000);

    const offer = await this.offers.create({
      id: generateId(),
      saleId: sale.id,
      userId: cmd.buyerUserId,
      amount: cmd.amount,
      expiresAt,
    });

    await this.eventBus.publish(
      offerSubmittedEvent({
        offerId: offer.id,
        saleId: sale.id,
        sessionId: sale.sessionId,
        sellerId: sale.sellerId,
        buyerUserId: cmd.buyerUserId,
        amount: cmd.amount.toString(),
        expiresAt: expiresAt.toISOString(),
      }),
    );

    return Ok({ offerId: offer.id, amount: offer.amount, expiresAt: offer.expiresAt });
  }
}
