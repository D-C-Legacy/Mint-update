import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';

export class UserNotFoundError extends DomainError {
  readonly code = ErrorCodes.NOT_FOUND;

  constructor(userId: string) {
    super(`User ${userId} not found`);
  }
}
