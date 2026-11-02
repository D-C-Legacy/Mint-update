import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyGuard } from './idempotency.interceptor';

@Module({
  imports: [DatabaseModule],
  providers: [IdempotencyService, IdempotencyGuard],
  exports: [IdempotencyService, IdempotencyGuard],
})
export class IdempotencyModule {}
