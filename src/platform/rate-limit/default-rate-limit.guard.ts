import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ErrorCodes } from '../../shared/errors/error-codes';
import { RateLimitedHttpException } from '../../shared/errors/rate-limited.exception';
import { AuthenticatedUser } from '../auth/jwt.guard';
import { RateLimitService } from './rate-limit.service';
import { SKIP_DEFAULT_RATE_LIMIT_KEY } from './skip-default-rate-limit.decorator';

// 05-API-SPEC.md §13's "Default authenticated: 100/min per user" catch-all, applied via
// @UseGuards(JwtGuard, DefaultRateLimitGuard) — order matters: it relies on JwtGuard having
// already set `request.user` earlier in the same guard chain (NestJS runs @UseGuards() entries
// in array order), never on a request.user it resolves itself. Routes with their own
// more-specific scope (bid, offer, upload-url, login, register) are checked at the use-case
// layer instead and simply never carry this guard; @SkipDefaultRateLimit() exists only for the
// rare case where a class-level guard would otherwise also reach one of those routes.
@Injectable()
export class DefaultRateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimit: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_DEFAULT_RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    const userId = request.user?.id ?? 'anonymous';

    const { allowed, retryAfterSeconds } = await this.rateLimit.check('defaultAuthenticated', userId);
    if (!allowed) {
      throw new RateLimitedHttpException(
        ErrorCodes.RATE_LIMITED,
        'Rate limit exceeded: 100 requests/min per user',
        { retryAfterSeconds },
        retryAfterSeconds,
      );
    }

    return true;
  }
}
