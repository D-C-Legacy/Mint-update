import { HttpException } from '@nestjs/common';
import { ErrorCodes } from './error-codes';
import { getHttpStatus } from './http-status';

// Thrown directly by JwtGuard/RolesGuard — a transport-level check that runs before any module's
// use case is ever reached, so it can't be a DomainError owned by one module. Same placement
// precedent as IdempotencyKeyRequiredException/RateLimitedHttpException: a plain HttpException
// subtype living in shared/errors/, not routed through toHttpException(). Phase 9 hardening: both
// guards previously threw Nest's bare UnauthorizedException()/ForbiddenException(), whose default
// body (`{statusCode, message, error}`) is not this project's `{error:{code,message,details}}`
// envelope — flagged in every integration phase's write-up since Phase 2 ("unauthenticated-401-
// not-in-envelope"), never fixed until now.
export class UnauthenticatedHttpException extends HttpException {
  constructor() {
    super(
      { error: { code: ErrorCodes.UNAUTHENTICATED, message: 'Authentication required', details: undefined } },
      getHttpStatus(ErrorCodes.UNAUTHENTICATED),
    );
  }
}

export class ForbiddenHttpException extends HttpException {
  constructor() {
    super(
      { error: { code: ErrorCodes.FORBIDDEN, message: 'You do not have access to this resource', details: undefined } },
      getHttpStatus(ErrorCodes.FORBIDDEN),
    );
  }
}
