import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { Clock, CLOCK } from '../../../../shared/time/clock';
import { generateId } from '../../../../shared/ids/id';
import { salesConfig } from '../../../../config/sales.config';
import { QueueService } from '../../../../platform/queue/queue.service';
import { QueueNames } from '../../../../platform/queue/queue.names';
import { SALE_REPOSITORY, SaleRepositoryPort } from '../../domain/ports/sale.repository.port';
import { SaleMode } from '../../domain/entities/sale.entity';
import {
  OutOfStockError,
  ProductNotFoundError,
  SellerNotApprovedError,
  SellerProfileNotFoundError,
} from '../../domain/errors/sales.errors';
import { requireApprovedSellerId } from '../require-approved-seller-id';
import { SellersService } from '../../../sellers/application/sellers.service';
import { CatalogService } from '../../../catalog/application/catalog.service';
import { AUCTION_CLOSE_JOB, auctionCloseJobId } from './place-bid.usecase';

export type CreateSaleCommand =
  | {
      readonly sellerUserId: string;
      readonly sessionId: string;
      readonly productId: string;
      readonly mode: 'AUCTION';
      readonly currency: string;
      readonly startAmount: bigint;
      readonly durationSeconds?: number;
    }
  | {
      readonly sellerUserId: string;
      readonly sessionId: string;
      readonly productId: string;
      readonly mode: 'BUY_NOW';
      readonly currency: string;
      readonly price: bigint;
      readonly quantity: number;
    }
  | {
      readonly sellerUserId: string;
      readonly sessionId: string;
      readonly productId: string;
      readonly mode: 'OFFER';
      readonly currency: string;
    };

export interface CreateSaleResult {
  readonly saleId: string;
  readonly mode: SaleMode;
}

// 03-DATA-MODEL.md §4: "reserved increments when a sale opens" — this is where that happens
// for every mode, closing the gap flagged repeatedly since P3-03 (close-auction's EXPIRED path
// and buy-now's rollback path both previously had nothing upstream reserving in the first place).
const RESERVATION_QTY_BY_MODE: Record<SaleMode, (cmd: CreateSaleCommand) => number> = {
  AUCTION: () => 1,
  OFFER: () => 1,
  BUY_NOW: (cmd) => (cmd.mode === 'BUY_NOW' ? cmd.quantity : 1),
};

@Injectable()
export class CreateSaleUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly sales: SaleRepositoryPort,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly sellers: SellersService,
    private readonly catalog: CatalogService,
    private readonly queue: QueueService,
  ) {}

  async execute(
    cmd: CreateSaleCommand,
  ): Promise<
    Result<CreateSaleResult, SellerProfileNotFoundError | SellerNotApprovedError | ProductNotFoundError | OutOfStockError>
  > {
    const sellerIdResult = await requireApprovedSellerId(this.sellers, cmd.sellerUserId);
    if (!sellerIdResult.ok) {
      return Err(sellerIdResult.error);
    }

    // Also verifies the product belongs to this seller (CatalogService.getProduct scopes by
    // the caller's own resolved seller id) — 404s, doesn't leak existence of other sellers'
    // products, same as catalog's own routes.
    const productResult = await this.catalog.getProduct({ userId: cmd.sellerUserId, productId: cmd.productId });
    if (!productResult.ok) {
      return Err(new ProductNotFoundError(cmd.productId));
    }

    const qty = RESERVATION_QTY_BY_MODE[cmd.mode](cmd);
    const reserved = await this.catalog.reserveStock({ productId: cmd.productId, qty });
    if (!reserved.ok) {
      return Err(new OutOfStockError(cmd.productId, qty));
    }

    const now = this.clock.now();
    const endsAt =
      cmd.mode === 'AUCTION'
        ? new Date(now.getTime() + (cmd.durationSeconds ?? salesConfig.defaultAuctionDurationSeconds) * 1000)
        : null;

    const sale = await this.sales.create({
      id: generateId(),
      sessionId: cmd.sessionId,
      sellerId: sellerIdResult.value,
      productId: cmd.productId,
      mode: cmd.mode,
      currency: cmd.currency,
      startAmount: cmd.mode === 'AUCTION' ? cmd.startAmount : null,
      endsAt,
      price: cmd.mode === 'BUY_NOW' ? cmd.price : null,
      quantity: qty,
    });

    // 06-REALTIME-AND-CONCURRENCY.md §6: "When a sale opens → enqueue auction.close at
    // endsAt" — the other half of this (reschedule on extend) was already built in P5-06.
    if (cmd.mode === 'AUCTION' && endsAt) {
      await this.queue.schedule(
        QueueNames.SALES,
        AUCTION_CLOSE_JOB,
        { saleId: sale.id },
        Math.max(0, endsAt.getTime() - now.getTime()),
        auctionCloseJobId(sale.id),
      );
    }

    return Ok({ saleId: sale.id, mode: sale.mode });
  }
}
