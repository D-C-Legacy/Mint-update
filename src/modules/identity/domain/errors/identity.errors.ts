import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';

export class EmailAlreadyRegisteredError extends DomainError {
  readonly code = ErrorCodes.EMAIL_ALREADY_REGISTERED;

  constructor(email: string) {
    super(`Email already registered: ${email}`);
  }
}

export class PhoneAlreadyInUseError extends DomainError {
  readonly code = ErrorCodes.PHONE_ALREADY_IN_USE;

  constructor(phone: string) {
    super(`Phone number already in use: ${phone}`);
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly code = ErrorCodes.INVALID_CREDENTIALS;

  constructor() {
    super('Invalid email or password');
  }
}

export class InvalidTokenError extends DomainError {
  readonly code = ErrorCodes.INVALID_TOKEN;

  constructor(message = 'Invalid or expired token') {
    super(message);
  }
}

// 05-API-SPEC.md §13: 5 per 15 min per IP + email. Keyed on the attempted email (not the
// resolved user — most attempts never resolve to one) plus IP, so a distributed attacker can't
// bypass the limit by rotating IPs against a single victim email, or vice versa.
export class LoginRateLimitedError extends DomainError {
  readonly code = ErrorCodes.RATE_LIMITED;

  constructor(retryAfterSeconds: number) {
    super('Login rate limit exceeded: 5 attempts per 15 min per IP + email', { retryAfterSeconds });
  }
}

// 05-API-SPEC.md §13: 3 per hour per IP.
export class RegisterRateLimitedError extends DomainError {
  readonly code = ErrorCodes.RATE_LIMITED;

  constructor(retryAfterSeconds: number) {
    super('Registration rate limit exceeded: 3 per hour per IP', { retryAfterSeconds });
  }
}

// Not in 05-API-SPEC.md §13 — added 24 Oct 2026 once the verification token became a short,
// guessable 6-digit code. 10 per 15 min per IP (see rate-limit.config.ts's own comment).
export class VerifyEmailRateLimitedError extends DomainError {
  readonly code = ErrorCodes.RATE_LIMITED;

  constructor(retryAfterSeconds: number) {
    super('Email verification rate limit exceeded: 10 attempts per 15 min per IP', {
      retryAfterSeconds,
    });
  }
}

// The requested provider's env vars (client id/secret, team/key id, private key, etc.) aren't
// set yet. 25 Oct 2026: expected, standing state until the founder sends real Google/Apple OAuth
// credentials — the whole point of building this now is that filling those in later needs no
// further code change, just config.
export class OAuthProviderNotConfiguredError extends DomainError {
  readonly code = ErrorCodes.OAUTH_PROVIDER_NOT_CONFIGURED;

  constructor(provider: 'GOOGLE' | 'APPLE') {
    super(`${provider} sign-in is not configured yet`, { provider });
  }
}

// Signature/issuer/audience/expiry/nonce mismatch, or the provider's token says its own email
// isn't verified. Deliberately one generic error for every verification failure — like
// InvalidCredentialsError, there's nothing a caller should be told to distinguish between these.
export class OAuthTokenInvalidError extends DomainError {
  readonly code = ErrorCodes.OAUTH_TOKEN_INVALID;

  constructor(provider: 'GOOGLE' | 'APPLE') {
    super(`${provider} sign-in token could not be verified`, { provider });
  }
}

// Not in 05-API-SPEC.md §13 (OAuth isn't in the docs at all) — added 25 Oct 2026, same class of
// live-added limit as VerifyEmailRateLimitedError above. 10 per 15 min per IP: generous enough
// for real retries, tight enough to bound JWKS-verification cost per IP.
export class OAuthRateLimitedError extends DomainError {
  readonly code = ErrorCodes.RATE_LIMITED;

  constructor(retryAfterSeconds: number) {
    super('OAuth sign-in rate limit exceeded: 10 attempts per 15 min per IP', {
      retryAfterSeconds,
    });
  }
}

export class CurrentPasswordIncorrectError extends DomainError {
  readonly code = ErrorCodes.CURRENT_PASSWORD_INCORRECT;

  constructor() {
    super('Current password is incorrect');
  }
}

export class AddressLimitReachedError extends DomainError {
  readonly code = ErrorCodes.ADDRESS_LIMIT_REACHED;

  constructor(limit: number) {
    super(`You can save at most ${limit} addresses`, { limit });
  }
}

// Generic NOT_FOUND, same as DeviceNotFoundError: "not yours" looks like "does not exist".
export class AddressNotFoundError extends DomainError {
  readonly code = ErrorCodes.NOT_FOUND;

  constructor(addressId: string) {
    super(`No address found: ${addressId}`, { addressId });
  }
}

// Generic NOT_FOUND on purpose: a device id has no module-specific code in the registry, and
// "not yours" is deliberately indistinguishable from "does not exist".
export class DeviceNotFoundError extends DomainError {
  readonly code = ErrorCodes.NOT_FOUND;

  constructor(deviceId: string) {
    super(`No device found: ${deviceId}`, { deviceId });
  }
}

// 05-API-SPEC.md §13: "Upload URL requests: 20/min per user" — the avatar upload-url route.
// Mirrors catalog's/sellers'/channels' own UploadRateLimitedError (same shared RATE_LIMITED code),
// for the same cross-module-boundary reason.
export class UploadRateLimitedError extends DomainError {
  readonly code = ErrorCodes.RATE_LIMITED;

  constructor(retryAfterSeconds: number) {
    super('Upload URL rate limit exceeded: 20/min per user', { retryAfterSeconds });
  }
}

// The client sent a storage key that wasn't minted for this user. Generic VALIDATION_ERROR — a
// malformed request, not a domain state. An avatar key is only ever minted by
// RequestAvatarUploadUseCase under the caller's own userId prefix.
export class InvalidStorageKeyError extends DomainError {
  readonly code = ErrorCodes.VALIDATION_ERROR;

  constructor(userId: string) {
    super(`Storage key is not valid for user ${userId}`);
  }
}

// AccountDeletionBlockedError (seller-balance/unresolved-order blockers) lives in
// modules/account-deletion/domain/errors — it needs SellersService/LedgerService/OrdersService,
// which IdentityModule deliberately never imports (see request-account-deletion.usecase.ts).
export class AccountDeletionAlreadyPendingError extends DomainError {
  readonly code = ErrorCodes.ACCOUNT_DELETION_ALREADY_PENDING;

  constructor(scheduledFor: Date) {
    super('A deletion request is already pending for this account', {
      scheduledFor: scheduledFor.toISOString(),
    });
  }
}

export class AccountDeletionNotPendingError extends DomainError {
  readonly code = ErrorCodes.ACCOUNT_DELETION_NOT_PENDING;

  constructor() {
    super('No pending deletion request to cancel');
  }
}
