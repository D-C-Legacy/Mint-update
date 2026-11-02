import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  ACCOUNT_DELETION_COMPLETED_EVENT,
  AccountDeletionCompletedPayload,
} from '../../../identity/events/published/account-deletion-completed.event';
import { NotificationsService } from '../../application/notifications.service';

// Unlike the other 3 account-deletion handlers, this one does NOT look the user up via
// IdentityService — by the time this event publishes, ExecuteAccountDeletionUseCase has already
// scrubbed User.email, so a lookup would return the anonymized address. The real address rides in
// the event payload instead (see account-deletion-completed.event.ts).
@Injectable()
export class OnAccountDeletionCompletedHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<AccountDeletionCompletedPayload>(
      ACCOUNT_DELETION_COMPLETED_EVENT,
      async (event) => {
        await this.notifications.sendRawEmail(
          event.payload.email,
          'Your Swish account has been deleted',
          'Your Swish account and personal data have been permanently deleted, as you requested.',
        );
      },
    );
  }
}
