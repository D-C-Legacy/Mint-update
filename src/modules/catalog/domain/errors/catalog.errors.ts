import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';
import { ProductStatus } from '../entities/product.entity';

export class SellerNotApprovedError extends DomainError {
  readonly code = ErrorCodes.SELLER_NOT_APPROVED;

  constructor() {
    super('Seller must be approved before managing products');
  }
}

// Mirrors sellers' own SellerApplicationNotFoundError (same shared error code, so the same
// HTTP status), but declared locally: catalog cannot import modules/sellers/domain/** across
// the module boundary, only SellersService (application/*.service.ts).
export class SellerProfileNotFoundError extends DomainError {
  readonly code = ErrorCodes.SELLER_APPLICATION_NOT_FOUND;

  constructor(userId: string) {
    super(`No seller profile found for user: ${userId}`);
  }
}

export class ProductNotFoundError extends DomainError {
  readonly code = ErrorCodes.PRODUCT_NOT_FOUND;

  constructor(productId: string) {
    super(`No product found: ${productId}`);
  }
}

// 05-API-SPEC.md §13: "Upload URL requests: 20/min per user" — product-image upload-url
// requests. Declared locally (not reused from sellers' own UploadRateLimitedError) for the same
// cross-module-boundary reason as SellerProfileNotFoundError above.
export class UploadRateLimitedError extends DomainError {
  readonly code = ErrorCodes.RATE_LIMITED;

  constructor(retryAfterSeconds: number) {
    super('Upload URL rate limit exceeded: 20/min per user', { retryAfterSeconds });
  }
}

export class CategoryNotFoundError extends DomainError {
  readonly code = ErrorCodes.CATEGORY_NOT_FOUND;

  constructor(categoryId: string) {
    super(`No category found: ${categoryId}`);
  }
}

export class InvalidProductQuantityError extends DomainError {
  readonly code = ErrorCodes.INVALID_PRODUCT_QUANTITY;

  constructor(quantity: number, reserved: number) {
    super(`Quantity (${quantity}) cannot be less than reserved (${reserved})`, {
      quantity,
      reserved,
    });
  }
}

export class ProductImageNotFoundError extends DomainError {
  readonly code = ErrorCodes.PRODUCT_IMAGE_NOT_FOUND;

  constructor(imageId: string) {
    super(`No product image found: ${imageId}`);
  }
}

// The product status state machine (publish/unpublish) is a table-driven domain rule — this error
// mirrors sellers' InvalidSellerStatusError one-for-one (same shared code family, same shape).
export class InvalidProductStatusError extends DomainError {
  readonly code = ErrorCodes.INVALID_PRODUCT_STATUS;

  constructor(action: string, expected: ProductStatus, actual: ProductStatus) {
    super(`Cannot ${action}: expected status ${expected}, got ${actual}`, { expected, actual });
  }
}

// Publishing is gated on the product having at least one attached image — a product can only go
// live with a real photo. Confirmed by the user (Hammas) 15 Oct 2026, not a doc-given rule
// (prompt.md §9's original note was his own speculation about the natural trigger, not a founder
// instruction). Reusing the generic VALIDATION_ERROR code keeps the registry unchanged; the app's
// error text is what the seller sees.
export class ProductNotPublishableError extends DomainError {
  readonly code = ErrorCodes.PRODUCT_NOT_PUBLISHABLE;

  constructor(productId: string) {
    super(`Product ${productId} has no images; add at least one before publishing`, { productId });
  }
}

// The client sent a storage key that wasn't minted for this product. Generic VALIDATION_ERROR —
// a malformed request, not a domain state. A key is only ever minted for a product the caller
// owns, so a key from any other product is rejected before it can be attached.
export class InvalidStorageKeyError extends DomainError {
  readonly code = ErrorCodes.VALIDATION_ERROR;

  constructor(productId: string) {
    super(`Storage key is not valid for product ${productId}`);
  }
}

// 06-REALTIME-AND-CONCURRENCY.md §7: "Zero rows returned means someone else took the last
// unit. Reject with OUT_OF_STOCK." — the doc names this exact code.
export class OutOfStockError extends DomainError {
  readonly code = ErrorCodes.OUT_OF_STOCK;

  constructor(productId: string, qty: number) {
    super(`Not enough available stock for product ${productId} to reserve ${qty}`, {
      productId,
      qty,
    });
  }
}

export class InvalidStockReleaseError extends DomainError {
  readonly code = ErrorCodes.INVALID_STOCK_RELEASE;

  constructor(productId: string, qty: number) {
    super(`Cannot release ${qty} units for product ${productId}: no product, or reserved < qty`, {
      productId,
      qty,
    });
  }
}

// Reuses INVALID_STOCK_RELEASE — same "reservation accounting didn't line up" error family as
// InvalidStockReleaseError, just the other half of the rule (converting to sold, not releasing
// back to stock). No doc defines a distinct code for this: it's never HTTP-reachable, only ever
// raised internally by `on-sale-resolved.handler.ts` (modules/orders), where a failure means
// order creation and inventory have already drifted apart — a thrown, not returned, condition.
export class StockNotReservedError extends DomainError {
  readonly code = ErrorCodes.INVALID_STOCK_RELEASE;

  constructor(productId: string, qty: number) {
    super(
      `Cannot convert ${qty} reserved units to sold for product ${productId}: no product, reserved < qty, or quantity < qty`,
      { productId, qty },
    );
  }
}
