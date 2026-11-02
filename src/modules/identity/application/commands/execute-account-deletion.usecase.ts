import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import {
  SESSION_REPOSITORY,
  SessionRepositoryPort,
} from '../../domain/ports/session.repository.port';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { accountDeletionCompletedEvent } from '../../events/published/account-deletion-completed.event';

export interface ExecuteAccountDeletionCommand {
  readonly userId: string;
}

// Called only by AccountDeletionProcessor (both the primary delayed job and the sweep) — never
// from an HTTP route. AGENTS.md §4 "every background job is idempotent": re-running this against
// an already-DELETED or already-cancelled (deletionScheduledAt cleared) user is a safe no-op,
// which is what makes BullMQ's at-least-once retries and the sweep both safe to re-fire this.
@Injectable()
export class ExecuteAccountDeletionUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(cmd: ExecuteAccountDeletionCommand): Promise<void> {
    const user = await this.users.findById(cmd.userId);
    if (!user || !user.deletionScheduledAt || user.status === 'DELETED') {
      return; // already executed, or cancelled since the job was scheduled
    }
    if (user.deletionScheduledAt.getTime() > Date.now()) {
      return; // cancelled then re-requested with a later date — not due yet
    }

    // Captured before scrubbing: User.email is about to become unreadable, and this is the last
    // moment the real address exists anywhere.
    const realEmail = user.email;

    // Each user's own id guarantees uniqueness against the column's unique constraint without a
    // retry loop — no two users ever collide on their own id.
    const anonymizedEmail = `deleted-${user.id}@deleted.swish.app`;
    await this.users.executeDeletion(user.id, anonymizedEmail, 'Deleted User');
    // Catches the case where the account was re-authenticated during the grace window (logging in
    // to view the countdown, then never cancelling) — belt-and-suspenders on top of the
    // revokeAllForUser the request already did.
    await this.sessions.revokeAllForUser(user.id, new Date());

    await this.eventBus.publish(
      accountDeletionCompletedEvent({ userId: user.id, email: realEmail }),
    );
  }
}
