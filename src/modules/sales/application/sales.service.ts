import { Injectable } from '@nestjs/common';
import { Result } from '../../../shared/result/result';
import { CursorPage } from '../../../shared/pagination/cursor';
import {
  CreateSaleUseCase,
  CreateSaleCommand,
  CreateSaleResult,
} from './commands/create-sale.usecase';
import {
  CancelSaleUseCase,
  CancelSaleCommand,
  CancelSaleResult,
} from './commands/cancel-sale.usecase';
import {
  SwitchSaleModeUseCase,
  SwitchSaleModeCommand,
  SwitchSaleModeResult,
} from './commands/switch-sale-mode.usecase';
import { PlaceBidUseCase, PlaceBidCommand, PlaceBidResult } from './commands/place-bid.usecase';
import { BuyNowUseCase, BuyNowCommand, BuyNowResult } from './commands/buy-now.usecase';
import {
  SubmitOfferUseCase,
  SubmitOfferCommand,
  SubmitOfferResult,
} from './commands/submit-offer.usecase';
import {
  RespondToOfferUseCase,
  RespondToOfferCommand,
  RespondToOfferResult,
} from './commands/respond-to-offer.usecase';
import { GetSaleQuery, GetSaleCommand } from './queries/get-sale.query';
import { ListBidsQuery, ListBidsCommand } from './queries/list-bids.query';
import { ListPublicSalesQuery, ListPublicSalesCommand } from './queries/list-public-sales.query';
import { ListMyBidsQuery, ListMyBidsCommand } from './queries/list-my-bids.query';
import {
  ListSellerOffersQuery,
  ListSellerOffersCommand,
  SellerOffer,
} from './queries/list-seller-offers.query';
import {
  ListSessionPurchasesQuery,
  ListSessionPurchasesCommand,
  SessionPurchase,
} from './queries/list-session-purchases.query';
import {
  GetSessionSalesStatsQuery,
  GetSessionSalesStatsCommand,
} from './queries/get-session-sales-stats.query';
import { SessionSalesStats } from '../domain/ports/sale.repository.port';
import { Sale } from '../domain/entities/sale.entity';
import { Bid } from '../domain/entities/bid.entity';
import { BidRejection } from '../domain/entities/auction.entity';
import {
  BidBySellerError,
  BidRateLimitedError,
  OfferExpiredError,
  OfferNotFoundError,
  OfferRateLimitedError,
  OutOfStockError,
  ProductNotFoundError,
  SaleNotFoundError,
  SaleNotOpenError,
  SellerNotApprovedError,
  SellerProfileNotFoundError,
} from '../domain/errors/sales.errors';

@Injectable()
export class SalesService {
  constructor(
    private readonly createSaleUseCase: CreateSaleUseCase,
    private readonly cancelSaleUseCase: CancelSaleUseCase,
    private readonly switchSaleModeUseCase: SwitchSaleModeUseCase,
    private readonly placeBidUseCase: PlaceBidUseCase,
    private readonly buyNowUseCase: BuyNowUseCase,
    private readonly submitOfferUseCase: SubmitOfferUseCase,
    private readonly respondToOfferUseCase: RespondToOfferUseCase,
    private readonly getSaleQuery: GetSaleQuery,
    private readonly listBidsQuery: ListBidsQuery,
    private readonly listPublicSalesQuery: ListPublicSalesQuery,
    private readonly listMyBidsQuery: ListMyBidsQuery,
    private readonly listSellerOffersQuery: ListSellerOffersQuery,
    private readonly listSessionPurchasesQuery: ListSessionPurchasesQuery,
    private readonly getSessionSalesStatsQuery: GetSessionSalesStatsQuery,
  ) {}

  async createSale(
    cmd: CreateSaleCommand,
  ): Promise<
    Result<
      CreateSaleResult,
      SellerProfileNotFoundError | SellerNotApprovedError | ProductNotFoundError | OutOfStockError
    >
  > {
    return this.createSaleUseCase.execute(cmd);
  }

  async cancelSale(
    cmd: CancelSaleCommand,
  ): Promise<Result<CancelSaleResult, SaleNotFoundError | SaleNotOpenError>> {
    return this.cancelSaleUseCase.execute(cmd);
  }

  async switchSaleMode(
    cmd: SwitchSaleModeCommand,
  ): Promise<Result<SwitchSaleModeResult, SaleNotFoundError | SaleNotOpenError>> {
    return this.switchSaleModeUseCase.execute(cmd);
  }

  async placeBid(
    cmd: PlaceBidCommand,
  ): Promise<
    Result<
      PlaceBidResult,
      SaleNotFoundError | BidBySellerError | BidRejection | BidRateLimitedError
    >
  > {
    return this.placeBidUseCase.execute(cmd);
  }

  async buyNow(
    cmd: BuyNowCommand,
  ): Promise<Result<BuyNowResult, SaleNotFoundError | SaleNotOpenError | BidBySellerError>> {
    return this.buyNowUseCase.execute(cmd);
  }

  async submitOffer(
    cmd: SubmitOfferCommand,
  ): Promise<
    Result<
      SubmitOfferResult,
      SaleNotFoundError | SaleNotOpenError | BidBySellerError | OfferRateLimitedError
    >
  > {
    return this.submitOfferUseCase.execute(cmd);
  }

  async respondToOffer(
    cmd: RespondToOfferCommand,
  ): Promise<
    Result<
      RespondToOfferResult,
      OfferNotFoundError | OfferExpiredError | SaleNotOpenError | OfferRateLimitedError
    >
  > {
    return this.respondToOfferUseCase.execute(cmd);
  }

  async getSale(cmd: GetSaleCommand): Promise<Result<Sale, SaleNotFoundError>> {
    return this.getSaleQuery.execute(cmd);
  }

  async listPublicSales(cmd: ListPublicSalesCommand): Promise<CursorPage<Sale>> {
    return this.listPublicSalesQuery.execute(cmd);
  }

  async listMyBids(cmd: ListMyBidsCommand): Promise<CursorPage<Bid>> {
    return this.listMyBidsQuery.execute(cmd);
  }

  async listSellerOffers(cmd: ListSellerOffersCommand): Promise<CursorPage<SellerOffer>> {
    return this.listSellerOffersQuery.execute(cmd);
  }

  async listSessionPurchases(
    cmd: ListSessionPurchasesCommand,
  ): Promise<CursorPage<SessionPurchase>> {
    return this.listSessionPurchasesQuery.execute(cmd);
  }

  async getSessionSalesStats(cmd: GetSessionSalesStatsCommand): Promise<SessionSalesStats> {
    return this.getSessionSalesStatsQuery.execute(cmd);
  }

  async listBids(cmd: ListBidsCommand): Promise<CursorPage<Bid>> {
    return this.listBidsQuery.execute(cmd);
  }
}
