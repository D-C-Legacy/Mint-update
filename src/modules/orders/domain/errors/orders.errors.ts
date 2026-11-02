import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';
import { OrderStatus } from '../entities/order.entity';

// Same shape as sellers'/streaming's InvalidSellerStatusError/InvalidStreamStatusError, widened
// to a list of valid origin statuses — unlike those two state machines, more than one of Order's
// actions (CANCEL, REFUND, DISPUTE) legally fire from more than a single status.
export class InvalidOrderStatusError extends DomainError {
  readonly code = ErrorCodes.INVALID_ORDER_STATUS;

  constructor(action: string, expected: readonly OrderStatus[], actual: OrderStatus) {
    const expectedLabel = expected.length === 1 ? expected[0] : `one of ${expected.join(', ')}`;
    super(`Cannot ${action}: expected status ${expectedLabel}, got ${actual}`, { expected, actual });
  }
}

export class OrderNotFoundError extends DomainError {
  readonly code = ErrorCodes.ORDER_NOT_FOUND;

  constructor(orderId: string) {
    super(`No order found: ${orderId}`);
  }
}
