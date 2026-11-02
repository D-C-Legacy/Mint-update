import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';

export class ChannelNotFoundError extends DomainError {
  readonly code = ErrorCodes.CHANNEL_NOT_FOUND;

  constructor(identifier: string) {
    super(`No channel found: ${identifier}`);
  }
}

// Mirrors modules/sellers' SellerApplicationNotFoundError (same shared error code, so the same
// HTTP status), declared locally: channels cannot import modules/sellers/domain/** across the
// module boundary, only SellersService (application/*.service.ts). Same pattern as catalog's
// SellerProfileNotFoundError.
export class SellerProfileNotFoundError extends DomainError {
  readonly code = ErrorCodes.SELLER_APPLICATION_NOT_FOUND;

  constructor(userId: string) {
    super(`No seller profile found for user: ${userId}`);
  }
}

// 05-API-SPEC.md §13: "Upload URL requests: 20/min per user" — the channel banner upload-url route.
// Mirrors catalog's and sellers' own UploadRateLimitedError (same shared RATE_LIMITED code), for the
// same cross-module-boundary reason.
export class UploadRateLimitedError extends DomainError {
  readonly code = ErrorCodes.RATE_LIMITED;

  constructor(retryAfterSeconds: number) {
    super('Upload URL rate limit exceeded: 20/min per user', { retryAfterSeconds });
  }
}
