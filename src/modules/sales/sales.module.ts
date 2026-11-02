import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { QueueModule } from '../../platform/queue/queue.module';
import { EventsModule } from '../../platform/events/events.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { ObservabilityModule } from '../../platform/observability/observability.module';
import { SellersModule } from '../sellers/sellers.module';
import { OrdersModule } from '../orders/orders.module';
import { CatalogModule } from '../catalog/catalog.module';
import { IdentityModule } from '../identity/identity.module';
import { CLOCK, SystemClock } from '../../shared/time/clock';
import { SALE_REPOSITORY } from './domain/ports/sale.repository.port';
import { BID_REPOSITORY } from './domain/ports/bid.repository.port';
import { OFFER_REPOSITORY } from './domain/ports/offer.repository.port';
import { SalePrismaRepository } from './infra/repositories/sale.prisma.repository';
import { BidPrismaRepository } from './infra/repositories/bid.prisma.repository';
import { OfferPrismaRepository } from './infra/repositories/offer.prisma.repository';
import { CreateSaleUseCase } from './application/commands/create-sale.usecase';
import { CancelSaleUseCase } from './application/commands/cancel-sale.usecase';
import { SwitchSaleModeUseCase } from './application/commands/switch-sale-mode.usecase';
import { PlaceBidUseCase } from './application/commands/place-bid.usecase';
import { CloseAuctionUseCase } from './application/commands/close-auction.usecase';
import { BuyNowUseCase } from './application/commands/buy-now.usecase';
import { SubmitOfferUseCase } from './application/commands/submit-offer.usecase';
import { RespondToOfferUseCase } from './application/commands/respond-to-offer.usecase';
import { GetSaleQuery } from './application/queries/get-sale.query';
import { ListBidsQuery } from './application/queries/list-bids.query';
import { ListPublicSalesQuery } from './application/queries/list-public-sales.query';
import { ListMyBidsQuery } from './application/queries/list-my-bids.query';
import { ListSellerOffersQuery } from './application/queries/list-seller-offers.query';
import { ListSessionPurchasesQuery } from './application/queries/list-session-purchases.query';
import { GetSessionSalesStatsQuery } from './application/queries/get-session-sales-stats.query';
import { SalesService } from './application/sales.service';
import { AuctionCloseProcessor } from './infra/jobs/auction-close.processor';
import { OfferExpiryProcessor } from './infra/jobs/offer-expiry.processor';
import { SalesController } from './api/http/sales.controller';
import { SalesGateway } from './api/ws/sales.gateway';

// First ticket to wire modules/sales into the DI graph at all — every prior P5 ticket followed
// the established "domain/infra/application lands before module wiring" pattern (P2-03, P3-02,
// P4-02). CLOCK binds to SystemClock here for the first time too (P0-06 built the port,
// nothing bound it until now). AuctionCloseProcessor/OfferExpiryProcessor are registered as
// plain providers (not exported) so their constructors run and their OnModuleInit hooks fire
// at boot — same "event handler needs to be live" reasoning as P3-04's ChannelsModule wiring.
@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    QueueModule,
    EventsModule,
    AuthModule,
    RateLimitModule,
    ObservabilityModule,
    SellersModule,
    CatalogModule,
    OrdersModule,
    IdentityModule,
  ],
  controllers: [SalesController],
  providers: [
    { provide: SALE_REPOSITORY, useClass: SalePrismaRepository },
    { provide: BID_REPOSITORY, useClass: BidPrismaRepository },
    { provide: OFFER_REPOSITORY, useClass: OfferPrismaRepository },
    { provide: CLOCK, useClass: SystemClock },
    CreateSaleUseCase,
    CancelSaleUseCase,
    SwitchSaleModeUseCase,
    PlaceBidUseCase,
    CloseAuctionUseCase,
    BuyNowUseCase,
    SubmitOfferUseCase,
    RespondToOfferUseCase,
    GetSaleQuery,
    ListBidsQuery,
    ListPublicSalesQuery,
    ListMyBidsQuery,
    ListSellerOffersQuery,
    ListSessionPurchasesQuery,
    GetSessionSalesStatsQuery,
    SalesService,
    AuctionCloseProcessor,
    OfferExpiryProcessor,
    SalesGateway,
  ],
  exports: [SalesService],
})
export class SalesModule {}
