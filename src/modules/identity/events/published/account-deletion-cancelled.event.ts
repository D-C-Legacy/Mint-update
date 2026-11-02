import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const ACCOUNT_DELETION_CANCELLED_EVENT = 'identity.account-deletion-cancelled';
export const ACCOUNT_DELETION_CANCELLED_VERSION = 1;

export interface AccountDeletionCancelledPayload {
  readonly userId: string;
}

export function accountDeletionCancelledEvent(
  payload: AccountDeletionCancelledPayload,
): DomainEvent<AccountDeletionCancelledPayload> {
  return createDomainEvent(
    ACCOUNT_DELETION_CANCELLED_EVENT,
    ACCOUNT_DELETION_CANCELLED_VERSION,
    payload,
  );
}
