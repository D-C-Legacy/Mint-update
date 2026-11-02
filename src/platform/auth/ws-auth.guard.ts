import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { JwtService } from './jwt.service';

export interface AuthenticatedSocketData {
  userId: string;
  role: string;
}

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    this.authenticate(client);
    return true;
  }

  // Extracted in P4-04 so StreamingGateway's handleConnection can authenticate once at connect
  // time (06-REALTIME-AND-CONCURRENCY.md §1: "WsAuthGuard verifies JWT, attaches userId to
  // socket" happens on connect, before any room.join) using the same logic `canActivate` uses
  // per message — NestJS can't apply a `@UseGuards` decorator to the connection lifecycle hook
  // itself, so the gateway calls this directly instead of duplicating the token-verification code.
  authenticate(client: Socket): AuthenticatedSocketData {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      throw new WsException('Unauthorized');
    }

    try {
      const payload = this.jwt.verifyAccessToken(token);
      const data: AuthenticatedSocketData = { userId: payload.sub, role: payload.role };
      Object.assign(client.data, data);
      return data;
    } catch {
      throw new WsException('Unauthorized');
    }
  }
}
