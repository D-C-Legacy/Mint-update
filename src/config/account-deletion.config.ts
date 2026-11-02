import { env } from './env';

export const accountDeletionConfig = Object.freeze({
  // Apple App Store guideline 5.1.1(v): the account and its grace period are user decisions
  // (28 Oct 2026), not from a doc — same placeholder treatment as orders.config's
  // autoConfirmDeliveryDays until a real number is confirmed elsewhere.
  graceDays: env.ACCOUNT_DELETION_GRACE_DAYS,
  reminderDaysBefore: env.ACCOUNT_DELETION_REMINDER_DAYS_BEFORE,
});

export type AccountDeletionConfig = typeof accountDeletionConfig;
