import { HttpException } from '@nestjs/common';
import { DomainError } from './domain-error';
import { ErrorCodes } from './error-codes';
import { getHttpStatus } from './http-status';
import { RateLimitedHttpException } from './rate-limited.exception';

export function toHttpException(error: DomainError): HttpException {
  // Every RATE_LIMITED error (chat, bid, offer, upload-url, login, register — all use-case-level
  // checks) carries retryAfterSeconds in its details; routed through the dedicated exception
  // subclass so GlobalExceptionFilter can set the Retry-After header 05-API-SPEC.md §13
  // requires, which a plain HttpException has no way to do.
  if (error.code === ErrorCodes.RATE_LIMITED) {
    const retryAfterSeconds = typeof error.details?.['retryAfterSeconds'] === 'number' ? error.details['retryAfterSeconds'] : 1;
    return new RateLimitedHttpException(error.code, error.message, error.details, retryAfterSeconds);
  }

  return new HttpException(
    { error: { code: error.code, message: error.message, details: error.details } },
    getHttpStatus(error.code),
  );
}
