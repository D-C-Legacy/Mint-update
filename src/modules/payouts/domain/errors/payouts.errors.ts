import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';
import { PayoutStatus } from '../entities/payout.entity';

export class PayoutNotFoundError extends DomainError {
  readonly code = ErrorCodes.PAYOUT_NOT_FOUND;

  constructor(payoutId: string) {
    super(`No payout found: ${payoutId}`, { payoutId });
  }
}

// Added for P8-06's `POST /admin/payouts/:id/hold`. No doc defines which payout statuses can
// legally be held — PENDING-only is a reasoned, conservative default (a PROCESSING/SENT transfer
// can't be recalled; FAILED/REVERSED/HELD are already a settled or held state), flagged here same
// as every other unconfirmed business rule in this build (orders' REFUND/DISPUTE origin sets).
export class InvalidPayoutStatusError extends DomainError {
  readonly code = ErrorCodes.INVALID_PAYOUT_STATUS;

  constructor(action: string, expected: PayoutStatus, actual: PayoutStatus) {
    super(`Cannot ${action}: expected status ${expected}, got ${actual}`, { expected, actual });
  }
}
