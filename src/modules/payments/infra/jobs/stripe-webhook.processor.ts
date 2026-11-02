import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { redisConfig } from '../../../../config/redis.config';
import { QueueNames } from '../../../../platform/queue/queue.names';
import { WebhookEventService } from '../../../../platform/webhooks/webhook-event.service';
import { PaymentsService } from '../../application/payments.service';
import { wrapJobProcessor } from '../../../../platform/observability/job-wrapper';

export const STRIPE_WEBHOOK_JOB = 'stripe.webhook';

interface StripeWebhookJobData {
  readonly webhookEventId: string;
  readonly type: string;
  readonly payload: unknown;
}

// One Worker on the PAYMENTS queue, same per-module-owns-its-processor shape as
// modules/sales/infra/jobs/auction-close.processor.ts (P5-07) and streaming's
// stream-reconcile.processor.ts (P4-03) — a Worker needs its own dedicated Redis connection,
// built directly here rather than through QueueService.
//
// 05-API-SPEC.md §9 step 4 says this job "applies the ledger transaction with an idempotency
// key derived from the event id" — that requires per-event-type handling (payment_intent.
// succeeded -> mark Payment SUCCEEDED, update Order; charge.refunded -> update Refund; etc.)
// which doesn't exist yet: P6-07 ("Payment use cases") is the next ticket, and the ledger
// itself is P7. This ticket's own Touches column is `infra/jobs/**` only, no `application/**`,
// so this processor deliberately does the one thing it CAN do correctly today — mark the
// already-deduped WebhookEvent row processed — and is flagged, not silently left looking
// finished, as the real per-event dispatch point P6-07 needs to plug into.
@Injectable()
export class StripeWebhookProcessor implements OnModuleDestroy {
  private readonly connection = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });
  private readonly worker = new Worker(
    QueueNames.PAYMENTS,
    wrapJobProcessor(QueueNames.PAYMENTS, async (job) => {
      if (job.name !== STRIPE_WEBHOOK_JOB) {
        return;
      }
      const data = job.data as StripeWebhookJobData;
      try {
        // Dispatches on the event type; every branch checks current state first, so a retried or
        // re-delivered job changes nothing the second time.
        await this.payments.applyProviderEvent({ type: data.type, payload: data.payload });
        await this.webhookEvents.markProcessed(data.webhookEventId);
      } catch (err) {
        await this.webhookEvents.markProcessed(data.webhookEventId, err instanceof Error ? err.message : String(err));
        throw err;
      }
    }),
    { connection: this.connection },
  );

  constructor(
    private readonly webhookEvents: WebhookEventService,
    private readonly payments: PaymentsService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }
}
