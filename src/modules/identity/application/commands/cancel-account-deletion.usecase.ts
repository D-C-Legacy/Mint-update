import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import {
  AccountDeletionNotPendingError,
  InvalidTokenError,
} from '../../domain/errors/identity.errors';
import { accountDeletionCancelledEvent } from '../../events/published/account-deletion-cancelled.event';
import { QueueService } from '../../../../platform/queue/queue.service';
import { QueueNames } from '../../../../platform/queue/queue.names';
import {
  accountDeletionExecuteJobId,
  accountDeletionReminderJobId,
} from './request-account-deletion.usecase';

export interface CancelAccountDeletionCommand {
  readonly userId: string;
}

// Apple App Store guideline 5.1.1(v) account-deletion feature (28 Oct 2026). Per the founder:
// logging back in during the grace window and tapping Cancel is the only cancel path — no
// support/admin override.
@Injectable()
export class CancelAccountDeletionUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly queue: QueueService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(
    cmd: CancelAccountDeletionCommand,
  ): Promise<Result<{ cancelled: true }, InvalidTokenError | AccountDeletionNotPendingError>> {
    const user = await this.users.findById(cmd.userId);
    if (!user) {
      return Err(new InvalidTokenError());
    }
    if (!user.deletionScheduledAt) {
      return Err(new AccountDeletionNotPendingError());
    }

    await this.users.cancelDeletion(user.id);
    await Promise.all([
      this.queue.remove(QueueNames.IDENTITY, accountDeletionReminderJobId(user.id)),
      this.queue.remove(QueueNames.IDENTITY, accountDeletionExecuteJobId(user.id)),
    ]);

    await this.eventBus.publish(accountDeletionCancelledEvent({ userId: user.id }));

    return Ok({ cancelled: true });
  }
}
