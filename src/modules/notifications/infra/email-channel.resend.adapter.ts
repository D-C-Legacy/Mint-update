import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { emailConfig } from '../../../config/email.config';
import { ChannelSendOutcome, EmailChannelPort, SendEmailInput } from '../domain/ports/notification-channel.port';

@Injectable()
export class ResendEmailChannelAdapter implements EmailChannelPort {
  private readonly client = new Resend(emailConfig.resend.apiKey);

  async send(input: SendEmailInput): Promise<ChannelSendOutcome> {
    // `body` is opaque already-rendered content (same treatment as PushChannelPort's
    // title/body) — sent as `html` since receipts/payout statements are the kind of content
    // that benefits from basic formatting; template authors (P8-04) own escaping their own input.
    const { data, error } = await this.client.emails.send({
      from: emailConfig.resend.fromEmail,
      to: input.recipient,
      subject: input.subject,
      html: input.body,
    });

    if (error) {
      return { status: 'FAILED', providerMessageId: null, failureReason: error.name };
    }
    return { status: 'SENT', providerMessageId: data.id, failureReason: null };
  }
}
