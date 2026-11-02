import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const ACCOUNT_DELETION_COMPLETED_EVENT = 'identity.account-deletion-completed';
export const ACCOUNT_DELETION_COMPLETED_VERSION = 1;

// `email` rides in the payload rather than being looked up by the handler (unlike the other
// account-deletion events) — by the time this publishes, ExecuteAccountDeletionUseCase has
// already scrubbed User.email, so a fresh lookup would return the anonymized address, not the
// one the person actually reads mail at.
export interface AccountDeletionCompletedPayload {
  readonly userId: string;
  readonly email: string;
}

export function accountDeletionCompletedEvent(
  payload: AccountDeletionCompletedPayload,
): DomainEvent<AccountDeletionCompletedPayload> {
  return createDomainEvent(
    ACCOUNT_DELETION_COMPLETED_EVENT,
    ACCOUNT_DELETION_COMPLETED_VERSION,
    payload,
  );
}
