import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { redisConfig } from '../../../../config/redis.config';
import { QueueNames } from '../../../../platform/queue/queue.names';
import { QueueService } from '../../../../platform/queue/queue.service';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import {
  ACCOUNT_DELETION_EXECUTE_JOB,
  ACCOUNT_DELETION_REMINDER_JOB,
  accountDeletionExecuteJobId,
} from '../../application/commands/request-account-deletion.usecase';
import { ExecuteAccountDeletionUseCase } from '../../application/commands/execute-account-deletion.usecase';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { accountDeletionReminderDueEvent } from '../../events/published/account-deletion-reminder-due.event';
import { wrapJobProcessor } from '../../../../platform/observability/job-wrapper';

const ACCOUNT_DELETION_SWEEP_JOB_NAME = 'account-deletion.sweep';
const ACCOUNT_DELETION_SWEEP_JOB_ID = 'account-deletion-sweep';
// An account deletion is due once a day at most — unlike the 10s auction-close sweep, there's no
// realtime expectation here, so an hourly backstop is plenty.
const ACCOUNT_DELETION_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const SWEEP_BATCH_LIMIT = 100;

interface ReminderJobData {
  readonly userId: string;
  readonly scheduledFor: string;
}

interface ExecuteJobData {
  readonly userId: string;
}

// One Worker on the IDENTITY queue handling the two delayed jobs RequestAccountDeletionUseCase
// schedules, plus this ticket's own repeating sweep — same per-module-owns-its-processor shape as
// sales/infra/jobs/auction-close.processor.ts, same "sweep catches a dropped delayed job" reason
// (Apple's guideline has no tolerance for "the account just never got deleted").
@Injectable()
export class AccountDeletionProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly connection = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });
  private readonly worker = new Worker(
    QueueNames.IDENTITY,
    wrapJobProcessor(QueueNames.IDENTITY, async (job) => {
      if (job.name === ACCOUNT_DELETION_EXECUTE_JOB) {
        const data = job.data as ExecuteJobData;
        await this.executeAccountDeletionUseCase.execute({ userId: data.userId });
      } else if (job.name === ACCOUNT_DELETION_REMINDER_JOB) {
        const data = job.data as ReminderJobData;
        await this.eventBus.publish(
          accountDeletionReminderDueEvent({
            userId: data.userId,
            scheduledFor: data.scheduledFor,
          }),
        );
      } else if (job.name === ACCOUNT_DELETION_SWEEP_JOB_NAME) {
        await this.sweep();
      }
    }),
    { connection: this.connection },
  );

  constructor(
    private readonly queueService: QueueService,
    private readonly executeAccountDeletionUseCase: ExecuteAccountDeletionUseCase,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queueService.scheduleRepeating(
      QueueNames.IDENTITY,
      ACCOUNT_DELETION_SWEEP_JOB_NAME,
      {},
      ACCOUNT_DELETION_SWEEP_INTERVAL_MS,
      ACCOUNT_DELETION_SWEEP_JOB_ID,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }

  // Public for the same live-verification reason as AuctionCloseProcessor#sweep — no need to
  // wait out the real hourly interval to prove this works.
  async sweep(): Promise<void> {
    const due = await this.users.findDueForDeletion(new Date(), SWEEP_BATCH_LIMIT);
    await Promise.all(
      due.map((user) =>
        this.queueService.schedule(
          QueueNames.IDENTITY,
          ACCOUNT_DELETION_EXECUTE_JOB,
          { userId: user.id },
          0,
          accountDeletionExecuteJobId(user.id),
        ),
      ),
    );
  }
}
