import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getRequestContext } from '../../platform/logger/request-context';
import { LoggerService } from '../../platform/logger/logger.service';
import { captureException } from '../../platform/observability/sentry';
import { RateLimitedHttpException } from './rate-limited.exception';
import { ErrorCodes } from './error-codes';

// Supersedes P9-01's `RateLimitedExceptionFilter` (same Retry-After-header reasoning, folded in
// below) — registered via the `APP_FILTER` DI token (ObservabilityModule) rather than
// `app.useGlobalFilters(new ...())` in each `main.*.ts`, the first use of that pattern in this
// codebase, specifically so `LoggerService` can be constructor-injected rather than hand-wired.
// Catches everything (`@Catch()` with no argument), for two reasons P9-01's narrower filter didn't
// need to solve: (1) `meta.requestId` must be present on every error response, not just 429s, and
// an interceptor can't do this — a thrown exception never reaches an interceptor's success pipe;
// (2) a genuinely unexpected (non-`HttpException`) error needs to be logged and reported to
// Sentry exactly once, in one place, rather than relying on every call site to remember.
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const requestId = getRequestContext()?.requestId;

    if (exception instanceof RateLimitedHttpException) {
      response.header('Retry-After', String(exception.retryAfterSeconds));
      response.status(exception.getStatus()).send(withMeta(exception.getResponse(), requestId));
      return;
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).send(withMeta(exception.getResponse(), requestId));
      return;
    }

    // Genuinely unexpected — not a domain error translated via toHttpException, not a guard's
    // deliberate rejection. Logged with the real stack and reported to Sentry (a no-op if
    // SENTRY_DSN isn't configured) before responding, so the failure is never silently a bare 500.
    const error = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`Unhandled exception on ${request.method} ${request.url}: ${error.message}`, error.stack);
    captureException(error, { requestId, method: request.method, url: request.url });

    response.status(500).send(
      withMeta({ error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error', details: undefined } }, requestId),
    );
  }
}

function withMeta(body: unknown, requestId: string | undefined): unknown {
  if (!requestId || typeof body !== 'object' || body === null || Array.isArray(body)) {
    return body;
  }
  const existingMeta = (body as { meta?: Record<string, unknown> }).meta;
  return { ...body, meta: { ...existingMeta, requestId } };
}
