import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { redisConfig } from '../../../../config/redis.config';
import { QueueNames } from '../../../../platform/queue/queue.names';
import { QueueService } from '../../../../platform/queue/queue.service';
import { wrapJobProcessor } from '../../../../platform/observability/job-wrapper';
import { OFFER_REPOSITORY, OfferRepositoryPort } from '../../domain/ports/offer.repository.port';

const OFFER_EXPIRE_JOB_NAME = 'offer.expire-sweep';
const OFFER_EXPIRE_JOB_ID = 'offer-expire-sweep';
const OFFER_EXPIRE_INTERVAL_MS = 60_000;

// Housekeeping only — respond-to-offer.usecase.ts independently checks `expiresAt` itself, so
// a late-running or missed sweep tick never lets a stale offer be wrongly accepted/rejected.
// This just keeps `Offer.status` accurate for anything reading it directly (e.g. a future
// GET /sales/:id/offers-style query). Same per-module-owns-its-processor shape as
// modules/sales/infra/jobs/auction-close.processor.ts (P5-07) and streaming's reconcile (P4-03).
@Injectable()
export class OfferExpiryProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly connection = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });
  private readonly worker = new Worker(
    QueueNames.SALES,
    wrapJobProcessor(QueueNames.SALES, async (job) => {
      if (job.name === OFFER_EXPIRE_JOB_NAME) {
        await this.offers.expirePending();
      }
    }),
    { connection: this.connection },
  );

  constructor(
    private readonly queueService: QueueService,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepositoryPort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queueService.scheduleRepeating(
      QueueNames.SALES,
      OFFER_EXPIRE_JOB_NAME,
      {},
      OFFER_EXPIRE_INTERVAL_MS,
      OFFER_EXPIRE_JOB_ID,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }
}
