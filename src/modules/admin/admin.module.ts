import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { IdempotencyModule } from '../../platform/idempotency/idempotency.module';
import { SellersModule } from '../sellers/sellers.module';
import { ChatModule } from '../chat/chat.module';
import { OrdersModule } from '../orders/orders.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { PaymentsModule } from '../payments/payments.module';
import { LedgerModule } from '../ledger/ledger.module';
import { StreamingModule } from '../streaming/streaming.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { MessagingModule } from '../messaging/messaging.module';
import { HelpModule } from '../help/help.module';
import { ReportsModule } from '../reports/reports.module';
import { AUDIT_LOG_REPOSITORY } from './domain/ports/audit-log.repository.port';
import { AuditLogPrismaRepository } from './infra/repositories/audit-log.prisma.repository';
import { ADMIN_USER_REPOSITORY } from './domain/ports/admin-user.repository.port';
import { AdminUserPrismaRepository } from './infra/repositories/admin-user.prisma.repository';
import { ListAuditLogQuery } from './application/queries/list-audit-log.query';
import { ANALYTICS_REPOSITORY } from './domain/ports/analytics.repository.port';
import { AnalyticsPrismaRepository } from './infra/repositories/analytics.prisma.repository';
import { GetOrdersSummaryQuery } from './application/queries/get-orders-summary.query';
import { GetOrdersByStatusQuery } from './application/queries/get-orders-by-status.query';
import { GetSellersSummaryQuery } from './application/queries/get-sellers-summary.query';
import { GetPayoutsSummaryQuery } from './application/queries/get-payouts-summary.query';
import { AdminService } from './application/admin.service';
import { AdminController } from './api/http/admin.controller';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    RateLimitModule,
    IdempotencyModule,
    SellersModule,
    ChatModule,
    OrdersModule,
    PayoutsModule,
    PaymentsModule,
    LedgerModule,
    StreamingModule,
    ReviewsModule,
    MessagingModule,
    HelpModule,
    ReportsModule,
  ],
  controllers: [AdminController],
  providers: [
    { provide: AUDIT_LOG_REPOSITORY, useClass: AuditLogPrismaRepository },
    { provide: ADMIN_USER_REPOSITORY, useClass: AdminUserPrismaRepository },
    ListAuditLogQuery,
    { provide: ANALYTICS_REPOSITORY, useClass: AnalyticsPrismaRepository },
    GetOrdersSummaryQuery,
    GetOrdersByStatusQuery,
    GetSellersSummaryQuery,
    GetPayoutsSummaryQuery,
    AdminService,
  ],
  exports: [AdminService],
})
export class AdminModule {}
