import { createDomainEvent, DomainEvent } from '../../../../shared/events/domain-event';

export const PASSWORD_CHANGED_EVENT = 'identity.password-changed';
export const PASSWORD_CHANGED_VERSION = 1;

// Founder feedback (22 Oct 2026): a security notice email on password change. Same precedent as
// every other transactional notification in notifications/events/handlers — identity only
// publishes, the notifications module owns sending it.
export interface PasswordChangedPayload {
  readonly userId: string;
}

export function passwordChangedEvent(
  payload: PasswordChangedPayload,
): DomainEvent<PasswordChangedPayload> {
  return createDomainEvent(PASSWORD_CHANGED_EVENT, PASSWORD_CHANGED_VERSION, payload);
}
