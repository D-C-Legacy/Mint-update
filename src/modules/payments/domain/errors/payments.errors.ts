import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';

// Mirrors modules/orders' own OrderNotFoundError (same shared error code, so the same HTTP
// status) — declared locally because payments cannot import modules/orders/domain/** across the
// module boundary, only OrdersService (application/*.service.ts). Same pattern as catalog's
// SellerProfileNotFoundError mirroring sellers' SellerApplicationNotFoundError (P3-02).
export class OrderNotFoundError extends DomainError {
  readonly code = ErrorCodes.ORDER_NOT_FOUND;

  constructor(orderId: string) {
    super(`No order found: ${orderId}`);
  }
}

// Mirrors modules/orders' own InvalidOrderStatusError (same shared code, same HTTP status) for
// the one transition payments needs to check before charging a card — declared locally rather
// than importing orders' `transitionOrderStatus`/`InvalidOrderStatusError`, which would cross
// the module's domain boundary (AGENTS.md §4: cross-module calls go through
// application/*.service.ts only). `actual` is typed `string`, not orders' own `OrderStatus`,
// for the same reason — TypeScript infers the shape of whatever OrdersService.getOrder()
// returns structurally, no explicit cross-module type import needed (same pattern sales uses
// reading a Seller's fields off SellersService.getMySeller()'s return value).
export class OrderNotPayableError extends DomainError {
  readonly code = ErrorCodes.INVALID_ORDER_STATUS;

  constructor(orderId: string, actual: string) {
    super(`Cannot pay order ${orderId}: expected status PENDING_PAYMENT, got ${actual}`, {
      expected: ['PENDING_PAYMENT'],
      actual,
    });
  }
}

export class PaymentNotFoundError extends DomainError {
  readonly code = ErrorCodes.PAYMENT_NOT_FOUND;

  constructor(orderId: string) {
    super(`No payment found for order: ${orderId}`);
  }
}

export class PaymentNotSucceededError extends DomainError {
  readonly code = ErrorCodes.PAYMENT_NOT_SUCCEEDED;

  constructor(paymentId: string) {
    super(`Payment ${paymentId} has not succeeded, nothing to refund`);
  }
}

export class RefundExceedsRemainingError extends DomainError {
  readonly code = ErrorCodes.REFUND_EXCEEDS_REMAINING;

  constructor(paymentId: string, requested: bigint, remaining: bigint) {
    super(
      `Refund of ${requested} exceeds the ${remaining} still refundable on payment ${paymentId}`,
      {
        requested: requested.toString(),
        remaining: remaining.toString(),
      },
    );
  }
}

// First real use of IDEMPOTENCY_KEY_REQUIRED (ErrorCodes, seeded in P0-06, never consumed until
// now) — 05-API-SPEC.md §9: "Pay for an order. Idempotency-Key required."
export class IdempotencyKeyRequiredError extends DomainError {
  readonly code = ErrorCodes.IDEMPOTENCY_KEY_REQUIRED;

  constructor() {
    super('Idempotency-Key is required to pay an order');
  }
}

// Generic NOT_FOUND: a card id that is not one of the caller's saved cards looks exactly like a
// card that does not exist, so ids belonging to other customers cannot be probed.
export class PaymentMethodNotFoundError extends DomainError {
  readonly code = ErrorCodes.NOT_FOUND;

  constructor(paymentMethodId: string) {
    super(`No saved card found: ${paymentMethodId}`, { paymentMethodId });
  }
}
