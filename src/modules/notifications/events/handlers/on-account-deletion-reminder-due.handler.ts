import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  ACCOUNT_DELETION_REMINDER_DUE_EVENT,
  AccountDeletionReminderDuePayload,
} from '../../../identity/events/published/account-deletion-reminder-due.event';
import { IdentityService } from '../../../identity/application/identity.service';
import { NotificationsService } from '../../application/notifications.service';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Fires from AccountDeletionProcessor's reminder job (accountDeletionConfig.reminderDaysBefore
// ahead of the actual deletion), not from a user action — same cross-module-event split as the
// other 3 account-deletion handlers.
@Injectable()
export class OnAccountDeletionReminderDueHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly identity: IdentityService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<AccountDeletionReminderDuePayload>(
      ACCOUNT_DELETION_REMINDER_DUE_EVENT,
      async (event) => {
        const user = await this.identity.getUserById({ userId: event.payload.userId });
        // Cancelled since the reminder was scheduled — nothing to remind about.
        if (!user || !user.deletionScheduledAt) return;
        const when = formatDate(event.payload.scheduledFor);
        await this.notifications.sendRawEmail(
          user.email,
          'Reminder: your Swish account will be deleted soon',
          `Your Swish account is scheduled for permanent deletion on ${when}. Log back in before then and cancel it from your account settings if you've changed your mind.`,
        );
      },
    );
  }
}
