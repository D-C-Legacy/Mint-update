import { Module } from '@nestjs/common';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { IdentityModule } from '../identity/identity.module';
import { SellersModule } from '../sellers/sellers.module';
import { OrdersModule } from '../orders/orders.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AccountDeletionEligibilityService } from './application/account-deletion-eligibility.service';
import { AccountDeletionController } from './api/http/account-deletion.controller';

// Apple App Store guideline 5.1.1(v) account-deletion feature (28 Oct 2026). Sits above Identity/
// Sellers/Orders/Ledger the same way AdminModule already does — nothing imports this module back,
// so it's free to depend on all four without creating a cycle (see account-deletion-eligibility
// .service.ts and request-account-deletion.usecase.ts for why that placement matters here).
@Module({
  imports: [AuthModule, RateLimitModule, IdentityModule, SellersModule, OrdersModule, LedgerModule],
  controllers: [AccountDeletionController],
  providers: [AccountDeletionEligibilityService],
})
export class AccountDeletionModule {}
