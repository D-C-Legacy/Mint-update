import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  ACCOUNT_DELETION_CANCELLED_EVENT,
  AccountDeletionCancelledPayload,
} from '../../../identity/events/published/account-deletion-cancelled.event';
import { IdentityService } from '../../../identity/application/identity.service';
import { NotificationsService } from '../../application/notifications.service';

@Injectable()
export class OnAccountDeletionCancelledHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly identity: IdentityService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<AccountDeletionCancelledPayload>(
      ACCOUNT_DELETION_CANCELLED_EVENT,
      async (event) => {
        const user = await this.identity.getUserById({ userId: event.payload.userId });
        if (!user) return;
        await this.notifications.sendRawEmail(
          user.email,
          'Your Swish account deletion was cancelled',
          'Your pending account deletion request has been cancelled. Your account is active again.',
        );
      },
    );
  }
}
