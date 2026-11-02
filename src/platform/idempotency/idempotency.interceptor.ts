import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, concatMap, switchMap } from 'rxjs/operators';
import { AuthenticatedUser } from '../auth/jwt.guard';
import { IdempotencyKeyConflictException, IdempotencyKeyRequiredException } from '../../shared/errors/idempotency-key.exception';
import { IdempotencyService } from './idempotency.service';

const MAX_KEY_LENGTH = 128;

function normalizeForStorage(value: unknown): unknown {
  return value === undefined ? null : (JSON.parse(JSON.stringify(value)) as unknown);
}

// 04-FOLDER-STRUCTURE.md names this file `idempotency.guard.ts`, but a NestJS Guard
// (`CanActivate`) only ever runs BEFORE a handler — it has no way to observe the handler's
// return value or thrown error, and persisting the eventual response (so a retry can replay it)
// is the entire point of this ticket. A NestInterceptor wraps the handler on both sides, so
// that's the real mechanism here; named/placed as the doc's guard file conceptually (applied the
// same way, via a decorator on the route) but flagged as an interceptor, not a CanActivate, since
// calling it a guard would be misleading to whoever opens this file next.
//
// Applied via `@UseInterceptors(IdempotencyGuard)` on a route (after `JwtGuard` in the guard
// chain, so `request.user` is already set by the time this runs — Nest's pipeline is
// Guards -> Interceptors, so no explicit ordering decorator is needed the way two guards need
// one). Pre-handler: require the header, claim the key (or replay/conflict). Post-handler:
// persist the outcome — completed on a success or a known HttpException (both deterministic,
// safe to replay), released on anything else (a genuinely unexpected failure must allow a real
// retry, not get stuck replaying nothing forever).
@Injectable()
export class IdempotencyGuard implements NestInterceptor {
  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    const header = request.headers['idempotency-key'];
    const key = Array.isArray(header) ? header[0] : header;
    if (typeof key !== 'string' || key.trim().length === 0 || key.length > MAX_KEY_LENGTH) {
      throw new IdempotencyKeyRequiredException();
    }

    const endpoint = `${request.method} ${request.routeOptions?.url ?? request.url}`;
    const requestHash = createHash('sha256').update(JSON.stringify(request.body ?? null)).digest('hex');
    const userId = request.user?.id;

    return from(this.idempotency.checkAndLock(key, userId, endpoint, requestHash)).pipe(
      switchMap((check) => {
        if (check.outcome === 'body_mismatch') {
          throw new IdempotencyKeyConflictException('body_mismatch');
        }
        if (check.outcome === 'in_progress') {
          throw new IdempotencyKeyConflictException('in_progress');
        }
        if (check.outcome === 'replay') {
          reply.status(check.statusCode);
          return of(check.responseBody);
        }

        const httpCode = this.reflector.get<number>(HTTP_CODE_METADATA, context.getHandler()) ?? 200;
        return next.handle().pipe(
          concatMap((body) => {
            // Store the response through the exact same JSON round-trip Fastify's own serializer
            // will apply when it sends this response (BigInt/Date -> plain number/string via the
            // global shared/money/bigint-json.ts patch and Date's native toJSON) — Prisma's own
            // Json-column encoding of a raw BigInt/Date is a different, unverified code path, and
            // storing the pre-normalized form is what guarantees a replay is byte-identical to the
            // original response rather than merely "equivalent." Emitting the same normalized value
            // here (not the original `body`) keeps the very first response consistent with it too.
            const normalized = normalizeForStorage(body);
            return from(this.idempotency.complete(key, httpCode, normalized)).pipe(switchMap(() => of(normalized)));
          }),
          catchError((err: unknown) => {
            const sideEffect =
              err instanceof HttpException
                ? this.idempotency.complete(key, err.getStatus(), normalizeForStorage(err.getResponse()))
                : this.idempotency.release(key);
            return from(sideEffect).pipe(switchMap(() => throwError(() => err)));
          }),
        );
      }),
    );
  }
}
