import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { EventsModule } from '../../platform/events/events.module';
import { QueueModule } from '../../platform/queue/queue.module';
import { SellersModule } from '../sellers/sellers.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CLOCK, SystemClock } from '../../shared/time/clock';
import { ORDER_REPOSITORY } from './domain/ports/order.repository.port';
import { OrderPrismaRepository } from './infra/repositories/order.prisma.repository';
import { CreateOrderFromSaleUseCase } from './application/commands/create-order-from-sale.usecase';
import { MarkOrderPaidUseCase } from './application/commands/mark-order-paid.usecase';
import { MarkOrderRefundedUseCase } from './application/commands/mark-order-refunded.usecase';
import { MarkOrderDisputedUseCase } from './application/commands/mark-order-disputed.usecase';
import { ShipOrderUseCase } from './application/commands/ship-order.usecase';
import { ConfirmDeliveryUseCase } from './application/commands/confirm-delivery.usecase';
import { CancelOrderUseCase } from './application/commands/cancel-order.usecase';
import { CancelOrderAsSellerOrAdminUseCase } from './application/commands/cancel-order-as-seller-or-admin.usecase';
import { GetOrderQuery } from './application/queries/get-order.query';
import { ListDisputedOrdersQuery } from './application/queries/list-disputed-orders.query';
import { ListOrdersQuery } from './application/queries/list-orders.query';
import { ListMyOrdersQuery } from './application/queries/list-my-orders.query';
import { GetMyOrderQuery } from './application/queries/get-my-order.query';
import { ListSellerOrdersQuery } from './application/queries/list-seller-orders.query';
import { GetSellerOrdersSummaryQuery } from './application/queries/get-seller-orders-summary.query';
import { GetSellerOrdersByStatusQuery } from './application/queries/get-seller-orders-by-status.query';
import { SELLER_ANALYTICS_REPOSITORY } from './domain/ports/seller-analytics.repository.port';
import { SellerAnalyticsPrismaRepository } from './infra/repositories/seller-analytics.prisma.repository';
import { SetShippingAddressUseCase } from './application/commands/set-shipping-address.usecase';
import { OrdersController } from './api/http/orders.controller';
import { OrdersService } from './application/orders.service';
import { OnSaleResolvedHandler } from './events/handlers/on-sale-resolved.handler';
import { AutoConfirmDeliveryProcessor } from './infra/jobs/auto-confirm-delivery.processor';
import { OrdersGateway } from './api/ws/orders.gateway';

// First ticket to wire modules/orders into the DI graph — wired into AppModule now, not deferred
// to a later API ticket, same "event handler needs to be live at boot" reasoning as P3-04's
// ChannelsModule and P5's SalesModule (OnSaleResolvedHandler's onModuleInit must run for real).
// CLOCK binds here for the first time in this module (P6-07's MarkOrderPaidUseCase is the first
// consumer) — same "token exists since P0-06, nothing bound it until the first real use" shape
// as P5-06's own CLOCK binding. QueueModule added in P6-08 for AutoConfirmDeliveryProcessor's
// repeating sweep registration, same shape as sales' AuctionCloseProcessor.
@Module({
  imports: [
    DatabaseModule,
    EventsModule,
    QueueModule,
    AuthModule,
    RateLimitModule,
    SellersModule,
    CatalogModule,
  ],
  controllers: [OrdersController],
  providers: [
    ListMyOrdersQuery,
    GetMyOrderQuery,
    ListSellerOrdersQuery,
    GetSellerOrdersSummaryQuery,
    GetSellerOrdersByStatusQuery,
    SetShippingAddressUseCase,
    { provide: ORDER_REPOSITORY, useClass: OrderPrismaRepository },
    { provide: SELLER_ANALYTICS_REPOSITORY, useClass: SellerAnalyticsPrismaRepository },
    { provide: CLOCK, useClass: SystemClock },
    CreateOrderFromSaleUseCase,
    MarkOrderPaidUseCase,
    MarkOrderRefundedUseCase,
    MarkOrderDisputedUseCase,
    ShipOrderUseCase,
    ConfirmDeliveryUseCase,
    CancelOrderUseCase,
    CancelOrderAsSellerOrAdminUseCase,
    GetOrderQuery,
    ListDisputedOrdersQuery,
    ListOrdersQuery,
    OrdersService,
    OnSaleResolvedHandler,
    AutoConfirmDeliveryProcessor,
    OrdersGateway,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
