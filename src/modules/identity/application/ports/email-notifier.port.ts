export const EMAIL_NOTIFIER = Symbol('EmailNotifierPort');

export interface EmailNotifierPort {
  sendVerificationEmail(to: string, token: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string): Promise<void>;
}
