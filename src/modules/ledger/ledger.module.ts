import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { EventsModule } from '../../platform/events/events.module';
import { QueueModule } from '../../platform/queue/queue.module';
import { AlertingModule } from '../../platform/alerting/alerting.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { SellersModule } from '../sellers/sellers.module';
import { PaymentsModule } from '../payments/payments.module';
import { LEDGER_REPOSITORY } from './domain/ports/ledger.repository.port';
import { LedgerPrismaRepository } from './infra/repositories/ledger.prisma.repository';
import { LedgerService } from './application/ledger.service';
import { OnOrderPaidHandler } from './events/handlers/on-order-paid.handler';
import { OnOrderDeliveredHandler } from './events/handlers/on-order-delivered.handler';
import { OnOrderCancelledHandler } from './events/handlers/on-order-cancelled.handler';
import { OnPaymentRefundedHandler } from './events/handlers/on-payment-refunded.handler';
import { ReleasePendingProcessor } from './infra/jobs/release-pending.processor';
import { ReconcileProcessor } from './infra/jobs/reconcile.processor';
import { SellerLedgerController } from './api/http/seller-ledger.controller';

// Wired into AppModule now, not deferred to a later ticket — every event handler's onModuleInit
// must run at real process boot to actually subscribe (same "event handler needs to be live at
// boot" reasoning as P3-04's ChannelsModule / P6-01's OrdersModule), or this module's whole point
// (posting ledger transactions when orders are paid/delivered, cancelled, or refunded)
// silently never fires. SellersModule
// added in P7-05 for OnOrderDeliveredHandler's payoutHoldDays lookup; QueueModule added in P7-05
// for scheduling/consuming the delayed release-pending job, same shape as orders'/sales' own job
// scheduling. ReconcileProcessor (P7-08) reuses the same QueueModule import and `LEDGER` queue
// for its own nightly repeating job.
//
// PaymentsModule added in 3c (engineering backlog Phase 3): getReconciliationReport()'s 3rd
// check compares the ledger's own PLATFORM_CASH against the processor's real wallet. No import
// cycle exists — PaymentsModule depends on Orders/Identity/platforms, not on LedgerModule.
@Module({
  imports: [
    DatabaseModule,
    EventsModule,
    QueueModule,
    AlertingModule,
    AuthModule,
    RateLimitModule,
    SellersModule,
    PaymentsModule,
  ],
  controllers: [SellerLedgerController],
  providers: [
    { provide: LEDGER_REPOSITORY, useClass: LedgerPrismaRepository },
    LedgerService,
    OnOrderPaidHandler,
    OnOrderDeliveredHandler,
    OnOrderCancelledHandler,
    OnPaymentRefundedHandler,
    ReleasePendingProcessor,
    ReconcileProcessor,
  ],
  exports: [LedgerService],
})
export class LedgerModule {}
