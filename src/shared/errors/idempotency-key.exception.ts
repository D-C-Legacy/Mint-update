import { HttpException } from '@nestjs/common';
import { ErrorCodes } from './error-codes';
import { getHttpStatus } from './http-status';

// Thrown directly by platform/idempotency/idempotency.interceptor.ts — a transport-level check
// (is the header present at all, does a reused key's body match) that runs before any module's
// use case is ever reached, so it can't be a DomainError owned by one module. Same placement
// precedent as RateLimitedHttpException: a plain HttpException subtype living in shared/errors/,
// not routed through toHttpException() since there's no Result/use-case layer involved here.
export class IdempotencyKeyRequiredException extends HttpException {
  constructor() {
    super(
      { error: { code: ErrorCodes.IDEMPOTENCY_KEY_REQUIRED, message: 'Idempotency-Key header is required', details: undefined } },
      getHttpStatus(ErrorCodes.IDEMPOTENCY_KEY_REQUIRED),
    );
  }
}

export class IdempotencyKeyConflictException extends HttpException {
  constructor(reason: 'body_mismatch' | 'in_progress') {
    const message =
      reason === 'body_mismatch'
        ? 'Idempotency-Key was already used with a different request body'
        : 'A request with this Idempotency-Key is still being processed';
    super(
      { error: { code: ErrorCodes.IDEMPOTENCY_KEY_CONFLICT, message, details: { reason } } },
      getHttpStatus(ErrorCodes.IDEMPOTENCY_KEY_CONFLICT),
    );
  }
}
