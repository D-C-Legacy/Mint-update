import { Injectable } from '@nestjs/common';
import { IdentityService } from '../../../identity/application/identity.service';
import { NotificationsService } from '../../application/notifications.service';
import { NotificationCategory } from '../../domain/notification-category';

// Shared by all of this module's event handlers so each one stays a thin event-to-command adapter
// (same "real logic lives in the service" precedent as every other handler in this codebase) —
// resolving a user's EMAIL/PUSH recipients and fanning out to NotificationsService.notify() is
// identical across all of them, only the templateKey/data differ.
//
// Handlers that notify about something the user can switch off in their Settings screen pass a
// category; the dispatcher skips BOTH channels when that toggle is off (the toggles govern the
// notification, not one transport — a user who disabled bids does not want the outbid email
// either). Handlers for transactional events (seller application decision, payout sent) pass
// none and always send; the mapping of category to handler lives in the handlers, not here.
@Injectable()
export class UserNotificationDispatcher {
  constructor(
    private readonly identity: IdentityService,
    private readonly notifications: NotificationsService,
  ) {}

  async dispatch(
    userId: string,
    templateKey: string,
    data: Record<string, unknown>,
    category?: NotificationCategory,
  ): Promise<void> {
    // getPreferences() never returns null — the use case falls back to DEFAULT_USER_PREFERENCES
    // (all notifications on) when no row exists, so a user without settings behaves exactly as
    // they did before gating existed, and the record shape is the same one the app's Settings
    // screen writes through PATCH /me/preferences.
    const [user, preferences, pushTokens] = await Promise.all([
      this.identity.getUserById({ userId }),
      this.identity.getPreferences({ userId }),
      this.identity.getDeviceTokens({ userId }),
    ]);

    if (!this.categoryAllowed(category, preferences.notifications)) {
      return;
    }

    const sends: Promise<unknown>[] = [];
    if (user) {
      sends.push(
        this.notifications.notify({
          userId,
          templateKey,
          channel: 'EMAIL',
          recipient: user.email,
          data,
        }),
      );
    }
    for (const pushToken of pushTokens) {
      sends.push(
        this.notifications.notify({
          userId,
          templateKey,
          channel: 'PUSH',
          recipient: pushToken,
          data,
        }),
      );
    }
    await Promise.all(sends);
  }

  private categoryAllowed(
    category: NotificationCategory | undefined,
    notifications: { live: boolean; bids: boolean; orders: boolean; messages: boolean },
  ): boolean {
    if (!category) {
      return true;
    }
    switch (category) {
      case 'LIVE':
        return notifications.live;
      case 'BIDS':
        return notifications.bids;
      case 'ORDERS':
        return notifications.orders;
      case 'MESSAGES':
        return notifications.messages;
    }
  }
}
