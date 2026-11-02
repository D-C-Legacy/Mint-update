import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';

export class ReportNotFoundError extends DomainError {
  readonly code = ErrorCodes.NOT_FOUND;

  constructor(id: string) {
    super(`Report ${id} not found`, { id });
  }
}
