import { Module } from '@nestjs/common';
import { DatabaseModule } from './platform/database/database.module';
import { RedisModule } from './platform/redis/redis.module';
import { QueueModule } from './platform/queue/queue.module';
import { HealthModule } from './platform/health/health.module';
import { LoggerModule } from './platform/logger/logger.module';
import { ObservabilityModule } from './platform/observability/observability.module';
import { AlertingModule } from './platform/alerting/alerting.module';
import { IdentityModule } from './modules/identity/identity.module';
import { SellersModule } from './modules/sellers/sellers.module';
import { AdminModule } from './modules/admin/admin.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { StreamingModule } from './modules/streaming/streaming.module';
import { ChatModule } from './modules/chat/chat.module';
import { SalesModule } from './modules/sales/sales.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { HelpModule } from './modules/help/help.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AccountDeletionModule } from './modules/account-deletion/account-deletion.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    QueueModule,
    HealthModule,
    LoggerModule,
    ObservabilityModule,
    AlertingModule,
    IdentityModule,
    SellersModule,
    AdminModule,
    ChannelsModule,
    CatalogModule,
    StreamingModule,
    ChatModule,
    SalesModule,
    OrdersModule,
    PaymentsModule,
    LedgerModule,
    PayoutsModule,
    NotificationsModule,
    ReviewsModule,
    MessagingModule,
    HelpModule,
    ReportsModule,
    AccountDeletionModule,
  ],
})
export class AppModule {}
