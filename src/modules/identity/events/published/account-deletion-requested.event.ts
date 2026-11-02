import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const ACCOUNT_DELETION_REQUESTED_EVENT = 'identity.account-deletion-requested';
export const ACCOUNT_DELETION_REQUESTED_VERSION = 1;

// Apple App Store guideline 5.1.1(v) account-deletion feature (28 Oct 2026). Same "identity only
// publishes, notifications owns sending" split as password-changed.event.ts.
export interface AccountDeletionRequestedPayload {
  readonly userId: string;
  readonly scheduledFor: string; // ISO — events cross a process boundary over Redis
  readonly reminderAt: string;
}

export function accountDeletionRequestedEvent(
  payload: AccountDeletionRequestedPayload,
): DomainEvent<AccountDeletionRequestedPayload> {
  return createDomainEvent(
    ACCOUNT_DELETION_REQUESTED_EVENT,
    ACCOUNT_DELETION_REQUESTED_VERSION,
    payload,
  );
}
