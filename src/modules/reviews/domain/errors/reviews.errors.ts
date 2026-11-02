import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';
import { OrderStatus } from '../../../orders/domain/entities/order.entity';

export class ReviewNotFoundError extends DomainError {
  readonly code = ErrorCodes.NOT_FOUND;

  constructor(reviewId: string) {
    super(`Review ${reviewId} not found`, { reviewId });
  }
}

export class ReviewAlreadyExistsError extends DomainError {
  readonly code = ErrorCodes.REVIEW_ALREADY_EXISTS;

  constructor(orderId: string) {
    super(`Order ${orderId} already has a review`, { orderId });
  }
}

// Only a DELIVERED or COMPLETED order can be reviewed — a buyer reviewing before the item
// actually arrives would be reviewing nothing. Order.ts has no further status after COMPLETED
// (it's terminal, same as CANCELLED/REFUNDED), both of which are also excluded.
export class OrderNotReviewableError extends DomainError {
  readonly code = ErrorCodes.ORDER_NOT_REVIEWABLE;

  constructor(orderId: string, status: OrderStatus) {
    super(`Order ${orderId} cannot be reviewed yet (status ${status})`, { orderId, status });
  }
}
