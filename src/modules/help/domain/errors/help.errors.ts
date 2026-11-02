import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';

export class HelpArticleNotFoundError extends DomainError {
  readonly code = ErrorCodes.NOT_FOUND;

  constructor(id: string) {
    super(`Help article ${id} not found`, { id });
  }
}
