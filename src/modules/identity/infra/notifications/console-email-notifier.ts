import { Injectable, Logger } from '@nestjs/common';
import { EmailNotifierPort } from '../../application/ports/email-notifier.port';

// Temporary stand-in until P8-03 lands a real email adapter. Logs instead of sending.
@Injectable()
export class ConsoleEmailNotifier implements EmailNotifierPort {
  private readonly logger = new Logger(ConsoleEmailNotifier.name);

  sendVerificationEmail(to: string, token: string): Promise<void> {
    this.logger.log(`[stub] verification email to ${to}: token=${token}`);
    return Promise.resolve();
  }

  sendPasswordResetEmail(to: string, token: string): Promise<void> {
    this.logger.log(`[stub] password reset email to ${to}: token=${token}`);
    return Promise.resolve();
  }
}
