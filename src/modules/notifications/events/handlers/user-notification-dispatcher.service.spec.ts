import { describe, expect, it } from 'vitest';
import { UserNotificationDispatcher } from './user-notification-dispatcher.service';
import { IdentityService } from '../../../identity/application/identity.service';
import { NotificationsService } from '../../application/notifications.service';
import {
  DEFAULT_USER_PREFERENCES,
  NotificationPreferences,
  UserPreferences,
} from '../../../identity/domain/entities/user-preferences.entity';

// First application-layer spec in the codebase (every previous spec is a pure domain rule), so
// precedent for its shape is deliberately minimal: hand-rolled object fakes for the two concrete
// collaborators, no mocking library, no timers. What it locks down is the only behavior this
// service owns — the category gate — because everything past the gate (resolve template, render,
// record, send) is NotificationsService's already-tested path.
const TEST_USER_ID = 'usr_test_1';
const TEST_EMAIL = 'tmp-dispatcher@example.com';
const TEST_PUSH_TOKENS = ['ExponentPushToken[fake]', 'ExponentPushToken[other]'];

type NotifyCall = {
  userId: string;
  templateKey: string;
  channel: string;
  recipient: string;
  data: Record<string, unknown>;
};

function makeDispatcher(notificationsOpts?: Partial<NotificationPreferences>): {
  dispatcher: UserNotificationDispatcher;
  calls: NotifyCall[];
} {
  const calls: NotifyCall[] = [];
  const preferences: UserPreferences = notificationsOpts
    ? {
        notifications: { ...DEFAULT_USER_PREFERENCES.notifications, ...notificationsOpts },
        privacy: DEFAULT_USER_PREFERENCES.privacy,
      }
    : DEFAULT_USER_PREFERENCES;

  // Structural fakes instead of classes: IdentityService/NotificationsService are concrete
  // NestJS services with many injected deps, and this spec only exercises the dispatcher's
  // three read methods and one fan-out call of theirs.
  // Promise-returning (not async) methods: eslint's require-await flags fake methods that have
  // nothing to await — the cast to the concrete service types keeps the call sites honest.
  const identity = {
    getUserById: (cmd: { userId: string }) =>
      Promise.resolve(cmd.userId === TEST_USER_ID ? { id: TEST_USER_ID, email: TEST_EMAIL } : null),
    getPreferences: () => Promise.resolve(preferences),
    getDeviceTokens: () => Promise.resolve(TEST_PUSH_TOKENS),
  } as unknown as IdentityService;
  const notifications = {
    notify: (cmd: {
      userId: string;
      templateKey: string;
      channel: string;
      recipient: string;
      data: Record<string, unknown>;
    }) => {
      calls.push({ ...cmd });
      return Promise.resolve(undefined);
    },
  } as unknown as NotificationsService;

  return { dispatcher: new UserNotificationDispatcher(identity, notifications), calls };
}

describe('UserNotificationDispatcher', () => {
  it('sends EMAIL once plus PUSH once per registered device when the category toggle is on', async () => {
    const { dispatcher, calls } = makeDispatcher({ bids: true });

    await dispatcher.dispatch(TEST_USER_ID, 'sale.bid-outbid', { amount: '5000' }, 'BIDS');

    expect(calls).toHaveLength(3);
    expect(calls.filter((call) => call.channel === 'EMAIL')).toEqual([
      {
        userId: TEST_USER_ID,
        templateKey: 'sale.bid-outbid',
        channel: 'EMAIL',
        recipient: TEST_EMAIL,
        data: { amount: '5000' },
      },
    ]);
    expect(calls.filter((call) => call.channel === 'PUSH').map((call) => call.recipient)).toEqual(
      TEST_PUSH_TOKENS,
    );
  });

  it('sends nothing when the category toggle is off — both channels stay silent', async () => {
    const { dispatcher, calls } = makeDispatcher({ bids: false });

    await dispatcher.dispatch(TEST_USER_ID, 'sale.bid-outbid', { amount: '5000' }, 'BIDS');

    expect(calls).toEqual([]);
  });

  it('always sends transactional notifications (no category) regardless of every toggle', async () => {
    const { dispatcher, calls } = makeDispatcher({
      live: false,
      bids: false,
      orders: false,
      messages: false,
    });

    // Payout sent / seller decided: transactional, the handlers pass no category.
    await dispatcher.dispatch(TEST_USER_ID, 'payout.sent', { amountTotal: '9000' });

    expect(calls).toHaveLength(3);
    expect(calls.every((call) => call.templateKey === 'payout.sent')).toBe(true);
  });

  it('uses on-by-default preferences for a user who never saved settings (absent row)', async () => {
    // Simulated absent row = DEFAULT_USER_PREFERENCES (GetPreferencesUseCase fallback), so the
    // dispatcher must not silently gate anything off.
    const { dispatcher, calls } = makeDispatcher();

    await dispatcher.dispatch(TEST_USER_ID, 'stream.started', { title: 'Show' }, 'LIVE');

    expect(calls).toHaveLength(3);
  });

  it('still sends PUSH-only (no EMAIL row) when the user no longer resolves', async () => {
    // Existing dispatch behavior for a deleted/inactive user: email recipient is unavailable,
    // push tokens (if any remain) still get attempted. Kept covered so gating does not
    // accidentally reintroduce an EMAIL send here.
    const { dispatcher, calls } = makeDispatcher({ bids: true });

    // The fake resolves no user for a different id; feed a real-looking unknown id.
    await dispatcher.dispatch('usr_test_gone', 'sale.bid-outbid', {});

    expect(calls.map((call) => call.channel)).toEqual(['PUSH', 'PUSH']);
  });
});
