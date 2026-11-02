import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  PASSWORD_CHANGED_EVENT,
  PasswordChangedPayload,
} from '../../../identity/events/published/password-changed.event';
import { IdentityService } from '../../../identity/application/identity.service';
import { NotificationsService } from '../../application/notifications.service';

// Security notice (founder feedback, 22 Oct 2026): a plain email via sendRawEmail, same precedent
// as platform/alerting's own ops alerts — no NotificationDelivery row, no user-preference
// category, since a password-change alert is not something an account owner should be able to
// accidentally silence.
@Injectable()
export class OnPasswordChangedHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly identity: IdentityService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<PasswordChangedPayload>(PASSWORD_CHANGED_EVENT, async (event) => {
      const user = await this.identity.getUserById({ userId: event.payload.userId });
      if (!user) return;
      await this.notifications.sendRawEmail(
        user.email,
        'Your Swish password was changed',
        "Your account password was just changed. If this wasn't you, reset your password immediately and contact support.",
      );
    });
  }
}
