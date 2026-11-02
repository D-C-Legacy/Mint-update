import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  ACCOUNT_DELETION_REQUESTED_EVENT,
  AccountDeletionRequestedPayload,
} from '../../../identity/events/published/account-deletion-requested.event';
import { IdentityService } from '../../../identity/application/identity.service';
import { NotificationsService } from '../../application/notifications.service';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Apple App Store guideline 5.1.1(v) account-deletion feature. Same sendRawEmail precedent as
// OnPasswordChangedHandler — a security-adjacent notice, not togglable via notification prefs.
@Injectable()
export class OnAccountDeletionRequestedHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly identity: IdentityService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<AccountDeletionRequestedPayload>(
      ACCOUNT_DELETION_REQUESTED_EVENT,
      async (event) => {
        const user = await this.identity.getUserById({ userId: event.payload.userId });
        if (!user) return;
        const when = formatDate(event.payload.scheduledFor);
        await this.notifications.sendRawEmail(
          user.email,
          'Your Swish account is scheduled for deletion',
          `We received a request to delete your Swish account. It will be permanently deleted on ${when}. ` +
            "If this wasn't you, or you change your mind, log back in before then and cancel it from your account settings.",
        );
      },
    );
  }
}
