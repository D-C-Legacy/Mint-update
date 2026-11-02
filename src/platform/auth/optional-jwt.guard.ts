import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtService } from './jwt.service';
import { AuthenticatedUser } from './jwt.guard';
import { setRequestContextField } from '../logger/request-context';

// For the routes 05-API-SPEC.md marks auth "optional" (GET /sales/:id among them) — attaches
// `request.user` when a valid bearer token is present, same as JwtGuard, but never rejects the
// request when it's missing or invalid: an anonymous or stale-token caller still gets a response,
// just without the viewer-scoped fields a real JwtGuard route would have required. Phase 9
// hardening's first real use: `getSale()` reads `request.user` to decide whether to reveal
// `winnerUserId` to this specific caller.
@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      try {
        const payload = this.jwt.verifyAccessToken(header.slice('Bearer '.length));
        request.user = { id: payload.sub, role: payload.role };
        setRequestContextField('userId', payload.sub);
      } catch {
        // Invalid or expired token on an optional-auth route: treat as anonymous rather than
        // rejecting — the whole point of "optional" is that a bad token doesn't block the read.
      }
    }
    return true;
  }
}
