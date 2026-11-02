import { Injectable } from '@nestjs/common';
import { Expo } from 'expo-server-sdk';
import { ChannelSendOutcome, PushChannelPort, SendPushInput } from '../domain/ports/notification-channel.port';

// Expo's push API needs no access token for the standard (non-enhanced-security) tier — no doc
// names one, so nothing is read from env/config here, keeping this ticket inside its
// modules/notifications/infra/** Touches (a config/env addition would fall outside it).
@Injectable()
export class ExpoPushChannelAdapter implements PushChannelPort {
  private readonly client = new Expo();

  async send(input: SendPushInput): Promise<ChannelSendOutcome> {
    if (!Expo.isExpoPushToken(input.recipient)) {
      return { status: 'FAILED', providerMessageId: null, failureReason: 'InvalidExpoPushToken' };
    }

    const [ticket] = await this.client.sendPushNotificationsAsync([
      { to: input.recipient, title: input.title, body: input.body },
    ]);

    if (!ticket || ticket.status === 'ok') {
      return { status: 'SENT', providerMessageId: ticket?.id ?? null, failureReason: null };
    }

    // `details.error === 'DeviceNotRegistered'` is the token-invalidation signal this ticket's
    // deliverable asks for — surfaced distinctly here so a future caller can tell "uninstalled
    // app, stop sending" apart from a transient failure. Nothing yet consumes this to actually
    // deregister the Device row (that write is in modules/identity, outside this ticket's Touches,
    // and no ticket in 07-IMPLEMENTATION-PLAN.md owns it — same unowned-gap shape as the
    // POST/DELETE /me/devices routes flagged since P1-04).
    return {
      status: 'FAILED',
      providerMessageId: null,
      failureReason: ticket.details?.error ?? ticket.message,
    };
  }
}
