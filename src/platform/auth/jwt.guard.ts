import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtService } from './jwt.service';
import { setRequestContextField } from '../logger/request-context';
import { UnauthenticatedHttpException } from '../../shared/errors/guard.exception';

export interface AuthenticatedUser {
  readonly id: string;
  readonly role: string;
}

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthenticatedHttpException();
    }

    const token = header.slice('Bearer '.length);
    try {
      const payload = this.jwt.verifyAccessToken(token);
      request.user = { id: payload.sub, role: payload.role };
      setRequestContextField('userId', payload.sub);
      return true;
    } catch {
      throw new UnauthenticatedHttpException();
    }
  }
}
