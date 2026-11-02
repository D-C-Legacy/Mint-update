import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';
import { SaleStatus } from '../entities/sale.entity';

export class SaleNotFoundError extends DomainError {
  readonly code = ErrorCodes.SALE_NOT_FOUND;

  constructor(saleId: string) {
    super(`No sale found: ${saleId}`, { saleId });
  }
}

// 05-API-SPEC.md §7: "Already resolved, cancelled or expired" — the sale's own status has
// already moved off OPEN.
export class SaleNotOpenError extends DomainError {
  readonly code = ErrorCodes.SALE_NOT_OPEN;

  constructor(saleId: string, status: SaleStatus) {
    super(`Sale ${saleId} is not open (status: ${status})`, { saleId, status });
  }
}

// 05-API-SPEC.md §7: "Past endsAt" — status is still OPEN but the close job/sweeper
// (06-REALTIME-AND-CONCURRENCY.md §6) hasn't caught up yet.
export class SaleEndedError extends DomainError {
  readonly code = ErrorCodes.SALE_ENDED;

  constructor(saleId: string, endsAt: Date) {
    super(`Sale ${saleId} ended at ${endsAt.toISOString()}`, { saleId, endsAt: endsAt.toISOString() });
  }
}

// Documented only for bidding (05-API-SPEC.md §7: "Seller cannot bid on own item"), but it's
// the single shared code for "can't transact on your own sale" — reused as-is for buy-now and
// offer submission (P5-08) rather than inventing two more codes for the same guard.
export class BidBySellerError extends DomainError {
  readonly code = ErrorCodes.BID_BY_SELLER;

  constructor(saleId: string) {
    super(`Seller cannot transact on their own sale: ${saleId}`, { saleId });
  }
}

export class BidderAlreadyLeadingError extends DomainError {
  readonly code = ErrorCodes.BIDDER_ALREADY_LEADING;

  constructor(saleId: string) {
    super(`Bidder is already the highest bidder on sale: ${saleId}`, { saleId });
  }
}

export class BidTooLowError extends DomainError {
  readonly code = ErrorCodes.BID_TOO_LOW;

  constructor(saleId: string, minimumNext: bigint, currentAmount: bigint) {
    super(`Minimum next bid is ${minimumNext.toString()}`, {
      saleId,
      minimumNext: minimumNext.toString(),
      currentAmount: currentAmount.toString(),
    });
  }
}

// Mirrors catalog's own OutOfStockError (same shared code, so the same HTTP status), declared
// locally: sales cannot import modules/catalog/domain/** across the module boundary, only
// CatalogService (application/*.service.ts) — same pattern catalog itself used for sellers'
// SellerApplicationNotFoundError in P3-02.
export class OutOfStockError extends DomainError {
  readonly code = ErrorCodes.OUT_OF_STOCK;

  constructor(productId: string, qty: number) {
    super(`Not enough available stock for product ${productId} to reserve ${qty}`, { productId, qty });
  }
}

export class OfferNotFoundError extends DomainError {
  readonly code = ErrorCodes.OFFER_NOT_FOUND;

  constructor(offerId: string) {
    super(`No offer found: ${offerId}`, { offerId });
  }
}

// Reused for both "actually past expiresAt" and "already responded to" (status no longer
// PENDING) — 05-API-SPEC.md §7 only documents one code ("Offer window closed") for this
// family of rejection, not a separate one per cause.
export class OfferExpiredError extends DomainError {
  readonly code = ErrorCodes.OFFER_EXPIRED;

  constructor(offerId: string) {
    super(`Offer window closed: ${offerId}`, { offerId });
  }
}

// Mirrors sellers' own SellerApplicationNotFoundError / catalog's SellerNotApprovedError and
// ProductNotFoundError (same shared codes) — needed by create-sale/cancel-sale (P5-09), which
// resolve the caller's seller profile and the sale's product via SellersService/CatalogService
// only, never those modules' domain/** directly.
export class SellerProfileNotFoundError extends DomainError {
  readonly code = ErrorCodes.SELLER_APPLICATION_NOT_FOUND;

  constructor(userId: string) {
    super(`No seller profile found for user: ${userId}`);
  }
}

export class SellerNotApprovedError extends DomainError {
  readonly code = ErrorCodes.SELLER_NOT_APPROVED;

  constructor() {
    super('Seller must be approved before selling');
  }
}

export class ProductNotFoundError extends DomainError {
  readonly code = ErrorCodes.PRODUCT_NOT_FOUND;

  constructor(productId: string) {
    super(`No product found: ${productId}`, { productId });
  }
}

// 05-API-SPEC.md §13: "Bid (WS or HTTP): 5/sec per user" — checked once inside PlaceBidUseCase,
// so both transports (sales.controller.ts's POST /sales/:id/bids and sales.gateway.ts's
// bid.place) share the exact same bucket per bidder.
export class BidRateLimitedError extends DomainError {
  readonly code = ErrorCodes.RATE_LIMITED;

  constructor(retryAfterSeconds: number) {
    super('Bid rate limit exceeded: 5/sec per user', { retryAfterSeconds });
  }
}

// 05-API-SPEC.md §13: "Offer: 2/sec per user" — one shared code for both submit-offer (buyer)
// and respond-to-offer (seller); the doc names a single "Offer" scope, not one per action.
export class OfferRateLimitedError extends DomainError {
  readonly code = ErrorCodes.RATE_LIMITED;

  constructor(retryAfterSeconds: number) {
    super('Offer rate limit exceeded: 2/sec per user', { retryAfterSeconds });
  }
}
