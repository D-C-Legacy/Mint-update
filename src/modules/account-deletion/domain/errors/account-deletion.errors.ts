import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';

// Apple App Store guideline 5.1.1(v) account-deletion feature (28 Oct 2026). Carries the specific
// unresolved items (seller balance / unresolved orders) so the client can show exactly what to
// resolve before trying again.
export class AccountDeletionBlockedError extends DomainError {
  readonly code = ErrorCodes.ACCOUNT_DELETION_BLOCKED;

  constructor(reasons: readonly string[]) {
    super('Account deletion is blocked until these are resolved', { reasons });
  }
}
