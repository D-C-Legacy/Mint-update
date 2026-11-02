import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';

// Generic NOT_FOUND, same precedent as identity's DeviceNotFoundError/AddressNotFoundError:
// someone else's notification id looks identical to a missing one.
export class NotificationNotFoundError extends DomainError {
  readonly code = ErrorCodes.NOT_FOUND;

  constructor(id: string) {
    super(`No notification found: ${id}`, { id });
  }
}
