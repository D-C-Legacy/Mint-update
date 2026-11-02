import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { redisConfig } from '../../../../config/redis.config';
import { QueueNames } from '../../../../platform/queue/queue.names';
import { LedgerService } from '../../application/ledger.service';
import { RELEASE_PENDING_JOB } from '../../events/handlers/on-order-delivered.handler';
import { wrapJobProcessor } from '../../../../platform/observability/job-wrapper';

interface ReleasePendingJobData {
  readonly orderId: string;
  readonly sellerId: string;
}

// Same per-module-owns-its-processor shape as modules/sales/infra/jobs/auction-close.processor.ts
// (P5-07) / modules/orders/infra/jobs/auto-confirm-delivery.processor.ts (P6-08) — a Worker needs
// its own dedicated Redis connection, built directly here. Consumes the delayed job
// on-order-delivered.handler.ts schedules when a seller's payoutHoldDays is > 0; importing its
// job-name constant rather than re-deriving it is the same deliberate, flagged exception P5-07's
// processor took on place-bid.usecase.ts's AUCTION_CLOSE_JOB.
@Injectable()
export class ReleasePendingProcessor implements OnModuleDestroy {
  private readonly connection = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });
  private readonly worker = new Worker(
    QueueNames.LEDGER,
    wrapJobProcessor(QueueNames.LEDGER, async (job) => {
      if (job.name === RELEASE_PENDING_JOB) {
        const data = job.data as ReleasePendingJobData;
        await this.ledger.releasePendingForOrder({ orderId: data.orderId, sellerId: data.sellerId });
      }
    }),
    { connection: this.connection },
  );

  constructor(private readonly ledger: LedgerService) {}

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }
}
