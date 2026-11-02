import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { redisConfig } from '../../../../config/redis.config';
import { ordersConfig } from '../../../../config/orders.config';
import { QueueNames } from '../../../../platform/queue/queue.names';
import { QueueService } from '../../../../platform/queue/queue.service';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { ConfirmDeliveryUseCase } from '../../application/commands/confirm-delivery.usecase';
import { wrapJobProcessor } from '../../../../platform/observability/job-wrapper';

const AUTO_CONFIRM_SWEEP_JOB_NAME = 'order.auto-confirm-sweep';
const AUTO_CONFIRM_SWEEP_JOB_ID = 'order-auto-confirm-sweep';
// No doc gives a sweep frequency (00-PRD.md §4.4 only names the N-day threshold itself, and even
// that is a placeholder — see orders.config.ts) — hourly is a reasoned default, flagged, same
// treatment as the threshold itself. A day-granularity cutoff doesn't need tighter polling.
const AUTO_CONFIRM_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const SWEEP_BATCH_LIMIT = 100;

// Same per-module-owns-its-processor shape as modules/sales/infra/jobs/auction-close.processor.ts
// (P5-07) — a Worker needs its own dedicated Redis connection, built directly here.
@Injectable()
export class AutoConfirmDeliveryProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly connection = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });
  private readonly worker = new Worker(
    QueueNames.ORDERS,
    wrapJobProcessor(QueueNames.ORDERS, async (job) => {
      if (job.name === AUTO_CONFIRM_SWEEP_JOB_NAME) {
        await this.sweep();
      }
    }),
    { connection: this.connection },
  );

  constructor(
    private readonly queueService: QueueService,
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    private readonly confirmDeliveryUseCase: ConfirmDeliveryUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queueService.scheduleRepeating(
      QueueNames.ORDERS,
      AUTO_CONFIRM_SWEEP_JOB_NAME,
      {},
      AUTO_CONFIRM_SWEEP_INTERVAL_MS,
      AUTO_CONFIRM_SWEEP_JOB_ID,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }

  // Public specifically so live verification doesn't have to wait out the real interval — same
  // technique as P4-05's PresenceService#reapNow() and P5-07's AuctionCloseProcessor#sweep().
  async sweep(): Promise<void> {
    const cutoff = new Date(Date.now() - ordersConfig.autoConfirmDeliveryDays * 24 * 60 * 60 * 1000);
    const candidates = await this.orders.findShippedBefore(cutoff, SWEEP_BATCH_LIMIT);
    await Promise.all(
      candidates.map((order) => this.confirmDeliveryUseCase.execute({ orderId: order.id, source: 'AUTO' })),
    );
  }
}
