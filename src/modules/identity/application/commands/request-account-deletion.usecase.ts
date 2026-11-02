import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import {
  SESSION_REPOSITORY,
  SessionRepositoryPort,
} from '../../domain/ports/session.repository.port';
import {
  AccountDeletionAlreadyPendingError,
  InvalidTokenError,
} from '../../domain/errors/identity.errors';
import { accountDeletionConfig } from '../../../../config/account-deletion.config';
import { accountDeletionRequestedEvent } from '../../events/published/account-deletion-requested.event';
import { QueueService } from '../../../../platform/queue/queue.service';
import { QueueNames } from '../../../../platform/queue/queue.names';

export interface RequestAccountDeletionCommand {
  readonly userId: string;
}

export interface RequestAccountDeletionResult {
  readonly scheduledFor: Date;
}

// Job names + deterministic jobIds for the two delayed jobs this use case schedules — same
// "the use case that schedules a job owns its name/id, the processor and any canceller import
// from here" shape as sales/application/commands/place-bid.usecase.ts's AUCTION_CLOSE_JOB.
export const ACCOUNT_DELETION_REMINDER_JOB = 'account-deletion.reminder';
export const ACCOUNT_DELETION_EXECUTE_JOB = 'account-deletion.execute';

export function accountDeletionReminderJobId(userId: string): string {
  return `account-deletion-reminder-${userId}`;
}

export function accountDeletionExecuteJobId(userId: string): string {
  return `account-deletion-${userId}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// Apple App Store guideline 5.1.1(v) account-deletion feature (28 Oct 2026, user-directed
// addition, no doc covers this). Unconditional once called — whether the caller (a seller with
// an unpaid balance or an unresolved order) is even allowed to call this at all is decided before
// this runs, by modules/account-deletion's eligibility check. Keeping that check out of here on
// purpose: Sellers/Orders/Ledger all transitively import IdentityModule already (Sellers →
// Notifications → Identity, Ledger → Payments → Identity), so IdentityModule reaching back into
// any of them would create a module-import cycle that doesn't exist today. modules/account-
// deletion sits above all four instead, the same position AdminModule already occupies.
@Injectable()
export class RequestAccountDeletionUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    private readonly queue: QueueService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(
    cmd: RequestAccountDeletionCommand,
  ): Promise<
    Result<RequestAccountDeletionResult, InvalidTokenError | AccountDeletionAlreadyPendingError>
  > {
    const user = await this.users.findById(cmd.userId);
    if (!user) {
      return Err(new InvalidTokenError());
    }
    if (user.deletionScheduledAt) {
      return Err(new AccountDeletionAlreadyPendingError(user.deletionScheduledAt));
    }

    const requestedAt = new Date();
    const scheduledAt = addDays(requestedAt, accountDeletionConfig.graceDays);
    const reminderAt = addDays(
      requestedAt,
      accountDeletionConfig.graceDays - accountDeletionConfig.reminderDaysBefore,
    );

    await this.users.scheduleDeletion(user.id, requestedAt, scheduledAt);
    // Same "a sensitive account change ends every other session" precedent as change-password/
    // reset-password — the device making this request is signed out too; it only needs to read
    // the response once to know the deletion date.
    await this.sessions.revokeAllForUser(user.id, requestedAt);

    const reminderDelayMs = reminderAt.getTime() - requestedAt.getTime();
    const executeDelayMs = scheduledAt.getTime() - requestedAt.getTime();
    await Promise.all([
      // reminderDelayMs can be negative if reminderDaysBefore >= graceDays (misconfigured env) —
      // BullMQ treats a negative delay as "run immediately", which is the safe failure mode here.
      this.queue.schedule(
        QueueNames.IDENTITY,
        ACCOUNT_DELETION_REMINDER_JOB,
        { userId: user.id, scheduledFor: scheduledAt.toISOString() },
        reminderDelayMs,
        accountDeletionReminderJobId(user.id),
      ),
      this.queue.schedule(
        QueueNames.IDENTITY,
        ACCOUNT_DELETION_EXECUTE_JOB,
        { userId: user.id },
        executeDelayMs,
        accountDeletionExecuteJobId(user.id),
      ),
    ]);

    await this.eventBus.publish(
      accountDeletionRequestedEvent({
        userId: user.id,
        scheduledFor: scheduledAt.toISOString(),
        reminderAt: reminderAt.toISOString(),
      }),
    );

    return Ok({ scheduledFor: scheduledAt });
  }
}
