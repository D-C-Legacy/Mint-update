import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { redisConfig } from '../../../../config/redis.config';
import { QueueNames } from '../../../../platform/queue/queue.names';
import { QueueService } from '../../../../platform/queue/queue.service';
import { SALE_REPOSITORY, SaleRepositoryPort } from '../../domain/ports/sale.repository.port';
import { CloseAuctionUseCase } from '../../application/commands/close-auction.usecase';
import { AUCTION_CLOSE_JOB, auctionCloseJobId } from '../../application/commands/place-bid.usecase';
import { wrapJobProcessor } from '../../../../platform/observability/job-wrapper';

const AUCTION_SWEEP_JOB_NAME = 'auction.sweep';
const AUCTION_SWEEP_JOB_ID = 'auction-sweep';
const AUCTION_SWEEP_INTERVAL_MS = 10_000; // 06-REALTIME-AND-CONCURRENCY.md §6: "Every 10 seconds"
const SWEEP_BATCH_LIMIT = 100;

interface AuctionCloseJobData {
  readonly saleId: string;
}

// One Worker on the SALES queue handling two job names: `auction.close` (the primary path,
// enqueued by whichever ticket opens a sale and rescheduled by P5-06 on every extension) and
// `auction.sweep` (this ticket's own repeating backup, every 10s). Same per-module-owns-its-
// processor shape as modules/streaming/infra/jobs/stream-reconcile.processor.ts (P4-03) — a
// Worker needs its own dedicated Redis connection, built directly here rather than through a
// platform abstraction. Runs in all 3 processes today (AppModule still shared) — harmless,
// since BullMQ Workers on one queue compete for each job rather than each re-running it.
@Injectable()
export class AuctionCloseProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly connection = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });
  private readonly worker = new Worker(
    QueueNames.SALES,
    wrapJobProcessor(QueueNames.SALES, async (job) => {
      if (job.name === AUCTION_CLOSE_JOB) {
        const data = job.data as AuctionCloseJobData;
        await this.closeAuctionUseCase.execute({ saleId: data.saleId });
      } else if (job.name === AUCTION_SWEEP_JOB_NAME) {
        await this.sweep();
      }
    }),
    { connection: this.connection },
  );

  constructor(
    private readonly queueService: QueueService,
    private readonly closeAuctionUseCase: CloseAuctionUseCase,
    @Inject(SALE_REPOSITORY) private readonly sales: SaleRepositoryPort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queueService.scheduleRepeating(
      QueueNames.SALES,
      AUCTION_SWEEP_JOB_NAME,
      {},
      AUCTION_SWEEP_INTERVAL_MS,
      AUCTION_SWEEP_JOB_ID,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }

  // Re-enqueuing the same jobId when the primary job is merely delayed-but-pending is a safe
  // BullMQ no-op (dedup by jobId) — this only has a real effect when the original job was
  // actually lost (06-REALTIME-AND-CONCURRENCY.md §6: "a dropped Redis job must not leave an
  // auction open forever"). delay=0 since these are already overdue by the time the sweep finds them.
  // Public specifically so live verification doesn't have to wait out the real 10s interval —
  // same technique as modules/streaming/infra/presence.service.ts#reapNow() (P4-05).
  async sweep(): Promise<void> {
    const expired = await this.sales.findExpiredOpen(SWEEP_BATCH_LIMIT);
    await Promise.all(
      expired.map((sale) =>
        this.queueService.schedule(QueueNames.SALES, AUCTION_CLOSE_JOB, { saleId: sale.id }, 0, auctionCloseJobId(sale.id)),
      ),
    );
  }
}
