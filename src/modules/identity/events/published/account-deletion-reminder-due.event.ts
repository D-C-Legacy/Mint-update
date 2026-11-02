import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const ACCOUNT_DELETION_REMINDER_DUE_EVENT = 'identity.account-deletion-reminder-due';
export const ACCOUNT_DELETION_REMINDER_DUE_VERSION = 1;

export interface AccountDeletionReminderDuePayload {
  readonly userId: string;
  readonly scheduledFor: string; // ISO
}

export function accountDeletionReminderDueEvent(
  payload: AccountDeletionReminderDuePayload,
): DomainEvent<AccountDeletionReminderDuePayload> {
  return createDomainEvent(
    ACCOUNT_DELETION_REMINDER_DUE_EVENT,
    ACCOUNT_DELETION_REMINDER_DUE_VERSION,
    payload,
  );
}
