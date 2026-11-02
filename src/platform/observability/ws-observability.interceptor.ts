import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from, firstValueFrom } from 'rxjs';
import type { Socket } from 'socket.io';
import { generateId } from '../../shared/ids/id';
import { runWithRequestContext } from '../logger/request-context';
import { withSpan } from './tracing';

// WS has no middleware-equivalent concept to establish per-message context the way
// request-id.middleware.ts does for HTTP, and `@UseGuards` runs before `@UseInterceptors` in
// Nest's pipeline (Guards -> Interceptors), so by the time this runs, `WsAuthGuard` has already
// set `client.data.userId` — read directly rather than duplicating auth here. Applied at the
// gateway CLASS level (`@UseInterceptors(WsObservabilityInterceptor)` on StreamingGateway,
// SalesGateway, ChatGateway) so every `@SubscribeMessage` handler gets a fresh requestId, the
// room id (best-effort: whichever of `sessionId`/`saleId` the inbound message carries), and a
// manual OTel span — the "propagated into WS" half of 02-TRD.md §7's tracing requirement, since
// nothing auto-instruments a Socket.IO message handler the way HttpInstrumentation auto-covers
// HTTP routes.
@Injectable()
export class WsObservabilityInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const client = ctx.switchToWs().getClient<Socket>();
    const data = ctx.switchToWs().getData<Record<string, unknown> | undefined>();
    const handlerName = `${ctx.getClass().name}.${ctx.getHandler().name}`;
    const userId = (client.data as { userId?: string } | undefined)?.userId;
    const roomId = pickRoomId(data);
    const requestId = generateId();

    return from(
      runWithRequestContext({ requestId, ...(userId ? { userId } : {}), ...(roomId ? { roomId } : {}) }, () =>
        withSpan(`ws ${handlerName}`, () => firstValueFrom(next.handle(), { defaultValue: undefined })),
      ),
    );
  }
}

function pickRoomId(data: Record<string, unknown> | undefined): string | undefined {
  const sessionId = data?.['sessionId'];
  if (typeof sessionId === 'string') return sessionId;
  const saleId = data?.['saleId'];
  return typeof saleId === 'string' ? saleId : undefined;
}
