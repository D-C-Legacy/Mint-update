import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { redisConfig } from '../../config/redis.config';
import { alertingConfig } from '../../config/alerting.config';
import { QueueNames, QueueName } from '../queue/queue.names';
import { QueueService } from '../queue/queue.service';
import { wrapJobProcessor } from '../observability/job-wrapper';
import { bidLatencyHistogram, getQueueHandle, estimateHistogramQuantile } from '../observability/metrics';
import { WebhookEventService } from '../webhooks/webhook-event.service';
import { AlertingService } from './alerting.service';

const SWEEP_JOB_NAME = 'alerting.sweep';
const SWEEP_JOB_ID = 'alerting-sweep';

// 02-TRD.md §7's "Alerts" bullet + 07-IMPLEMENTATION-PLAN.md P9-04's own deliverable row: queue
// depth, job failure rate, webhook lag, and bid latency p95 are all threshold-over-a-window
// checks, naturally fitting one periodic sweep (same per-concern-owns-its-processor shape as
// every other repeating job in this build). Ledger reconciliation mismatch is deliberately NOT
// here — 03-DATA-MODEL.md §10 says "any violation raises a critical alert," an immediate signal
// the already-existing nightly `reconcile.processor.ts` is better placed to raise directly at the
// moment it detects a mismatch, not re-derived here on a 60s cadence.
@Injectable()
export class AlertSweepProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly connection = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });
  private readonly worker = new Worker(
    QueueNames.ALERTING,
    wrapJobProcessor(QueueNames.ALERTING, async (job) => {
      if (job.name === SWEEP_JOB_NAME) {
        await this.sweep();
      }
    }),
    { connection: this.connection },
  );

  constructor(
    private readonly queueService: QueueService,
    private readonly webhookEvents: WebhookEventService,
    private readonly alerting: AlertingService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queueService.scheduleRepeating(
      QueueNames.ALERTING,
      SWEEP_JOB_NAME,
      {},
      alertingConfig.sweepIntervalMs,
      SWEEP_JOB_ID,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }

  // Public specifically so live verification doesn't have to wait out the real interval — same
  // technique as every other periodic check in this codebase (PresenceService#reapNow(),
  // AuctionCloseProcessor#sweep(), AutoConfirmDeliveryProcessor#sweep()).
  async sweep(): Promise<void> {
    await Promise.all([
      this.checkQueueDepths(),
      this.checkJobFailureRates(),
      this.checkWebhookLag(),
      this.checkBidLatency(),
    ]);
  }

  private async checkQueueDepths(): Promise<void> {
    await Promise.all(
      Object.values(QueueNames).map(async (name) => {
        const counts = await getQueueHandle(name).getJobCounts('waiting', 'active', 'delayed');
        const depth = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
        if (depth > alertingConfig.queueDepthThreshold) {
          await this.alerting.sendCriticalAlert(
            `queue-depth:${name}`,
            `Queue depth over threshold: ${name}`,
            `Queue "${name}" has ${depth} waiting/active/delayed jobs, over the ${alertingConfig.queueDepthThreshold} threshold.`,
          );
        }
      }),
    );
  }

  private async checkJobFailureRates(): Promise<void> {
    const windowStart = Date.now() - alertingConfig.jobFailureWindowMinutes * 60_000;
    await Promise.all(
      Object.values(QueueNames).map(async (name: QueueName) => {
        if (name === QueueNames.ALERTING) {
          return;
        }
        const recentFailed = await getQueueHandle(name).getJobs(['failed'], 0, 200);
        const count = recentFailed.filter((j) => (j.finishedOn ?? 0) >= windowStart).length;
        if (count >= alertingConfig.jobFailureThreshold) {
          await this.alerting.sendCriticalAlert(
            `job-failure-rate:${name}`,
            `Job failure rate over threshold: ${name}`,
            `Queue "${name}" had ${count} failed jobs in the last ${alertingConfig.jobFailureWindowMinutes} minutes, at or over the ${alertingConfig.jobFailureThreshold} threshold.`,
          );
        }
      }),
    );
  }

  private async checkWebhookLag(): Promise<void> {
    const staleCount = await this.webhookEvents.countStaleUnprocessed(
      alertingConfig.webhookLagThresholdSeconds * 1000,
      'stripe',
    );
    if (staleCount > 0) {
      await this.alerting.sendCriticalAlert(
        'webhook-lag:stripe',
        'Payment webhook processing lag',
        `${staleCount} Stripe webhook event(s) have been unprocessed for over ${alertingConfig.webhookLagThresholdSeconds} seconds.`,
      );
    }
  }

  // Best-effort and same-process-only, flagged honestly: this reads `bidLatencyHistogram`'s LOCAL
  // in-process bucket data. Bids are observed wherever the HTTP/WS request happened to land
  // (api or realtime), but this sweep job runs on whichever of the 3 processes' competing
  // Workers claims the tick — if that happens to be the worker process (which never observes a
  // bid directly), this check sees an empty histogram and silently has nothing to report, even if
  // api/realtime are genuinely over budget. A fully correct fix needs either a real
  // Prometheus+Alertmanager deployment aggregating across instances (what this metric was built
  // for in P9-03, not provisioned anywhere in this stack) or centralizing latency observations
  // through Redis — both out of this ticket's scope. Flagged in PROGRESS.md/MEMORY.md, not hidden.
  private async checkBidLatency(): Promise<void> {
    const data = await bidLatencyHistogram.get();
    const p95 = estimateHistogramQuantile(data.values, 0.95);
    if (p95 !== null && p95 > alertingConfig.bidLatencyP95Seconds) {
      await this.alerting.sendCriticalAlert(
        'bid-latency-p95',
        'Bid latency p95 over budget',
        `Estimated bid validate-and-persist p95 is ~${(p95 * 1000).toFixed(0)}ms, over the ${(alertingConfig.bidLatencyP95Seconds * 1000).toFixed(0)}ms budget (02-TRD.md §8). Local-process estimate only — see code comment.`,
      );
    }
  }
}
