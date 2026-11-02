import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { redisConfig } from '../../../../config/redis.config';
import { QueueNames } from '../../../../platform/queue/queue.names';
import { QueueService } from '../../../../platform/queue/queue.service';
import { LedgerService } from '../../application/ledger.service';
import { wrapJobProcessor } from '../../../../platform/observability/job-wrapper';
import { AlertingService } from '../../../../platform/alerting/alerting.service';

const RECONCILE_JOB_NAME = 'ledger.reconcile';
const RECONCILE_JOB_ID = 'ledger-reconcile';
// 07-IMPLEMENTATION-PLAN.md's P7-08 deliverable literally says "Nightly" — unlike every other
// interval/threshold placeholder in this build (the payout schedule, the auto-confirm sweep),
// this cadence IS doc-given, not a guess.
const RECONCILE_INTERVAL_MS = 24 * 60 * 60 * 1000;

// 03-DATA-MODEL.md §10: "Invariant checked by a nightly job: for every transaction, SUM(debits)
// = SUM(credits). Any violation raises a critical alert." Same per-module-owns-its-processor
// shape as every prior job in this build (AuctionCloseProcessor, AutoConfirmDeliveryProcessor,
// ReleasePendingProcessor) — a Worker needs its own dedicated Redis connection, built directly
// here. Still throws on a mismatch (marks the BullMQ job FAILED — `job-wrapper.ts` already
// reports every job failure to Sentry and `jobFailuresCounter`, P9-03), but now ALSO calls
// `AlertingService.sendCriticalAlert()` directly, before throwing — "any violation raises a
// critical alert" (03-DATA-MODEL.md §10) reads as immediate, not "wait for P9-04's generic
// job-failure-rate sweep to notice a pattern on its next 15-minute-window tick" (P9-04). The
// actual check logic lives on `LedgerService.getReconciliationReport()` (moved there in P8-06 so
// `GET /admin/ledger/reconciliation` can call it too, without `modules/admin` reaching into this
// infra/jobs class directly — AGENTS.md §4's dependency direction only allows infra to depend on
// application, never the reverse).
@Injectable()
export class ReconcileProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly connection = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });
  private readonly worker = new Worker(
    QueueNames.LEDGER,
    wrapJobProcessor(QueueNames.LEDGER, async (job) => {
      if (job.name === RECONCILE_JOB_NAME) {
        const report = await this.ledgerService.getReconciliationReport();
        if (!report.ok) {
          await this.alerting.sendCriticalAlert(
            'ledger-reconciliation-mismatch',
            'Ledger reconciliation mismatch',
            `Nightly ledger reconciliation found a mismatch: ${JSON.stringify(report)}`,
          );
          throw new Error(`Ledger reconciliation found a mismatch: ${JSON.stringify(report)}`);
        }
      }
    }),
    { connection: this.connection },
  );

  constructor(
    private readonly queueService: QueueService,
    private readonly ledgerService: LedgerService,
    private readonly alerting: AlertingService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queueService.scheduleRepeating(
      QueueNames.LEDGER,
      RECONCILE_JOB_NAME,
      {},
      RECONCILE_INTERVAL_MS,
      RECONCILE_JOB_ID,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }
}
