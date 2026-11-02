import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import pino, { Logger as PinoLogger } from 'pino';
import { getRequestContext } from './request-context';

// Wraps pino (01-ARCHITECTURE.md: "Pino, JSON, request id + user id + room id on every line") —
// per AGENTS.md §4's "wraps a library so modules never import the library directly" rule, nothing
// outside this file imports `pino`. `mixin()` runs on every log call and merges in whatever the
// active async context holds, so call sites never pass these fields manually — `logger.info('bid
// accepted')` from deep inside PlaceBidUseCase automatically carries the same requestId a
// controller or gateway established at the top of the call chain. traceId/spanId come from
// OpenTelemetry's own active span (`@opentelemetry/api`), not request-context.ts's own store —
// 01-ARCHITECTURE.md lists "request id" and "trace id" as two separate rows (Logging vs Tracing),
// kept as two separate sources of truth here rather than collapsed into one.
@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: PinoLogger;

  // No constructor parameter — Nest's `@Injectable()` reflects every constructor parameter's
  // type into a DI token to auto-inject, even a primitive with a default value (`string` reflects
  // as the bare `String` token, which nothing provides); found live, not from reading the Nest
  // docs: `app.get(LoggerService)` failed to resolve at boot with "argument String at index [0]
  // is not available." Reading `process.env.SERVICE_NAME` inside the body instead needs no DI
  // token at all.
  constructor() {
    const serviceName = process.env.SERVICE_NAME ?? 'app';
    this.logger = pino({
      level: process.env.NODE_ENV === 'local' ? 'debug' : 'info',
      base: { service: serviceName },
      mixin(): Record<string, unknown> {
        const ctx = getRequestContext();
        const span = trace.getActiveSpan();
        const spanContext = span?.spanContext();
        return {
          ...(ctx?.requestId ? { requestId: ctx.requestId } : {}),
          ...(ctx?.userId ? { userId: ctx.userId } : {}),
          ...(ctx?.roomId ? { roomId: ctx.roomId } : {}),
          ...(spanContext ? { traceId: spanContext.traceId, spanId: spanContext.spanId } : {}),
        };
      },
    });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.info({ context: lastContext(optionalParams) }, stringify(message));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.error({ context: lastContext(optionalParams), trace: optionalParams[0] }, stringify(message));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.warn({ context: lastContext(optionalParams) }, stringify(message));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug({ context: lastContext(optionalParams) }, stringify(message));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.trace({ context: lastContext(optionalParams) }, stringify(message));
  }
}

// Nest's LoggerService interface passes a trailing "context" string (the calling class name) as
// the last optionalParam for log/warn/debug/verbose — surfaced as its own field rather than
// dropped, so Nest's own internal bootstrap logs ("NestFactory", "InstanceLoader", ...) keep their
// original meaning in the structured output.
function lastContext(optionalParams: unknown[]): unknown {
  return optionalParams.length > 0 ? optionalParams[optionalParams.length - 1] : undefined;
}

function stringify(message: unknown): string {
  return typeof message === 'string' ? message : JSON.stringify(message);
}
