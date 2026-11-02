import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const EMAIL_CHANGE_REQUESTED_EVENT = 'identity.email-change-requested';
export const EMAIL_CHANGE_REQUESTED_VERSION = 1;

// Founder feedback (22 Oct 2026): changing email is a two-step confirm flow (request, then
// ConfirmEmailChangeUseCase with the token this event carries) so a mistyped new address can
// never lock the account out — nothing on User changes until the link is confirmed. Two emails go
// out from this one event: a confirmation link to newEmail, and a security notice to oldEmail
// (the account's current, still-working address) in case this wasn't the account owner.
export interface EmailChangeRequestedPayload {
  readonly userId: string;
  readonly oldEmail: string;
  readonly newEmail: string;
  readonly confirmToken: string;
}

export function emailChangeRequestedEvent(
  payload: EmailChangeRequestedPayload,
): DomainEvent<EmailChangeRequestedPayload> {
  return createDomainEvent(EMAIL_CHANGE_REQUESTED_EVENT, EMAIL_CHANGE_REQUESTED_VERSION, payload);
}
