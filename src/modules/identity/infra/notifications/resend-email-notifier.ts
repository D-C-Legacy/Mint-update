import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { emailConfig } from '../../../../config/email.config';
import { EmailNotifierPort } from '../../application/ports/email-notifier.port';

// Real email delivery for identity's own auth emails (verification code, password reset).
// `ConsoleEmailNotifier` was bound unconditionally for every environment including production
// (founder feedback 24 Oct 2026: "it won't send me the codes") — this is likely the actual root
// cause, not the Resend sandbox-mode limit on other notification channels: this one never called
// Resend at all, it only ever logged to the server's own console. Kept as a separate, small client
// (rather than reusing `notifications` module's `ResendEmailChannelAdapter`) so identity stays
// self-contained — AGENTS.md §4: cross-module calls go through `application/*.service.ts`, not
// another module's infra adapter.
@Injectable()
export class ResendEmailNotifier implements EmailNotifierPort {
  private readonly logger = new Logger(ResendEmailNotifier.name);
  private readonly client = new Resend(emailConfig.resend.apiKey);

  async sendVerificationEmail(to: string, code: string): Promise<void> {
    const { error } = await this.client.emails.send({
      from: emailConfig.resend.fromEmail,
      to,
      subject: 'Your Swish verification code',
      html: `<p>Your verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p><p>This code expires in 15 minutes.</p>`,
    });
    if (error) this.logger.error(`Verification email to ${to} failed: ${error.name}`);
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const { error } = await this.client.emails.send({
      from: emailConfig.resend.fromEmail,
      to,
      subject: 'Reset your Swish password',
      html: `<p>Paste this reset token into the app to set a new password:</p><p style="font-size:16px;font-weight:bold;word-break:break-all;">${token}</p><p>This token expires in 1 hour.</p>`,
    });
    if (error) this.logger.error(`Password reset email to ${to} failed: ${error.name}`);
  }
}
