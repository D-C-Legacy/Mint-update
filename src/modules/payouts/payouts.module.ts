import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { EventsModule } from '../../platform/events/events.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { CLOCK, SystemClock } from '../../shared/time/clock';
import { LedgerModule } from '../ledger/ledger.module';
import { SellersModule } from '../sellers/sellers.module';
import { PAYOUT_REPOSITORY } from './domain/ports/payout.repository.port';
import { PayoutPrismaRepository } from './infra/repositories/payout.prisma.repository';
import { TRANSFER_PROVIDER } from './domain/ports/transfer-provider.port';
import { MockTransferAdapter } from './infra/transfer/mock-transfer.adapter';
import { RunPayoutUseCase } from './application/commands/run-payout.usecase';
import { HoldPayoutUseCase } from './application/commands/hold-payout.usecase';
import { GetPayoutStatementQuery } from './application/queries/get-payout-statement.query';
import { ListPayoutsByStatusQuery } from './application/queries/list-payouts-by-status.query';
import { ListPayoutRunsQuery } from './application/queries/list-payout-runs.query';
import { ListMyPayoutsQuery } from './application/queries/list-my-payouts.query';
import { PayoutsService } from './application/payouts.service';
import { SellerPayoutsController } from './api/http/seller-payouts.controller';

// Wired into app.module.ts as of P8-06 — `POST /admin/payout-runs` needs `RunPayoutUseCase`
// callable for real through the admin API, closing the gap this module's own prior comment
// flagged ("no admin HTTP trigger exists yet... whichever ticket adds one is what needs this
// wired in"). Still no scheduler/cron trigger — manual admin trigger only, per the documented route.
@Module({
  imports: [DatabaseModule, LedgerModule, EventsModule, AuthModule, RateLimitModule, SellersModule],
  controllers: [SellerPayoutsController],
  providers: [
    { provide: PAYOUT_REPOSITORY, useClass: PayoutPrismaRepository },
    { provide: TRANSFER_PROVIDER, useClass: MockTransferAdapter },
    { provide: CLOCK, useClass: SystemClock },
    RunPayoutUseCase,
    HoldPayoutUseCase,
    GetPayoutStatementQuery,
    ListPayoutsByStatusQuery,
    ListPayoutRunsQuery,
    ListMyPayoutsQuery,
    PayoutsService,
  ],
  exports: [PayoutsService],
})
export class PayoutsModule {}
