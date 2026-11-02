import { HttpException } from '@nestjs/common';

// A distinct subclass, not a plain HttpException, specifically so RateLimitedExceptionFilter can
// @Catch() it and attach a Retry-After header — HttpException itself has no headers option
// (HttpExceptionOptions is only {cause, description}), and there's no global exception filter in
// this codebase before P9-01, so this is the one new piece of infrastructure needed to satisfy
// 05-API-SPEC.md §13's "Exceeded limits return 429 with Retry-After" for every caller uniformly,
// whether the 429 came from a use-case-level Result (via toHttpException) or a guard
// (DefaultRateLimitGuard) throwing directly.
export class RateLimitedHttpException extends HttpException {
  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> | undefined,
    readonly retryAfterSeconds: number,
  ) {
    super({ error: { code, message, details } }, 429);
  }
}
