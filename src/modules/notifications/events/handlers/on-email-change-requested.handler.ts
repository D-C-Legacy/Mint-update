import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  EMAIL_CHANGE_REQUESTED_EVENT,
  EmailChangeRequestedPayload,
} from '../../../identity/events/published/email-change-requested.event';
import { NotificationsService } from '../../application/notifications.service';

// Two plain emails per request (founder feedback, 22 Oct 2026), both via sendRawEmail — same
// precedent as OnPasswordChangedHandler, no template registration needed for a one-off
// transactional send: a confirmation token to the new address (nothing on the account changes
// until ConfirmEmailChangeUseCase runs with it), and a security notice to the OLD address in case
// this wasn't the account owner. Token is pasted into the app's confirm screen, same manual-paste
// pattern the existing verify-email flow already uses — not a new mechanism.
@Injectable()
export class OnEmailChangeRequestedHandler implements OnModuleInit {
  private readonly logger = new Logger(OnEmailChangeRequestedHandler.name);

  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<EmailChangeRequestedPayload>(
      EMAIL_CHANGE_REQUESTED_EVENT,
      async (event) => {
        const { oldEmail, newEmail, confirmToken } = event.payload;
        // Same reasoning as ConsoleEmailNotifier for register/reset-password: Resend's sandbox
        // sender only delivers to the account's own verified addresses until a real sending
        // domain is verified, so this is the fallback way to retrieve the code until then.
        this.logger.log(
          `[fallback] email change confirm code for ${newEmail} (was ${oldEmail}): token=${confirmToken}`,
        );
        await Promise.all([
          this.notifications.sendRawEmail(
            newEmail,
            'Confirm your new Swish email',
            `Enter this code in the app to finish changing your Swish email: ${confirmToken}`,
          ),
          this.notifications.sendRawEmail(
            oldEmail,
            'Email change requested on your Swish account',
            `A request was made to change your account email to ${newEmail}. If this wasn't you, contact support immediately. Nothing has changed yet.`,
          ),
        ]);
      },
    );
  }
}
