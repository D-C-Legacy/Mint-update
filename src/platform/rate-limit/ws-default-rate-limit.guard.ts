import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { ErrorCodes } from '../../shared/errors/error-codes';
import { AuthenticatedSocketData } from '../auth/ws-auth.guard';
import { RateLimitService } from './rate-limit.service';
import { SKIP_DEFAULT_RATE_LIMIT_KEY } from './skip-default-rate-limit.decorator';

// WS counterpart to DefaultRateLimitGuard — same 100/min-per-user default, same "runs after
// WsAuthGuard in the same @UseGuards() chain so client.data.userId is already set" ordering
// requirement. No Retry-After header exists for Socket.IO; retryAfterSeconds is surfaced in the
// WsException's details instead, which toWsException already does for use-case-level
// RATE_LIMITED errors — this mirrors that shape so a client handles both the same way.
@Injectable()
export class WsDefaultRateLimitGuard implements CanActivate {
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

    const client = context.switchToWs().getClient<Socket>();
    const { userId } = client.data as AuthenticatedSocketData;

    const { allowed, retryAfterSeconds } = await this.rateLimit.check('defaultAuthenticated', userId);
    if (!allowed) {
      throw new WsException({
        code: ErrorCodes.RATE_LIMITED,
        message: 'Rate limit exceeded: 100 messages/min per user',
        details: { retryAfterSeconds },
      });
    }

    return true;
  }
}
