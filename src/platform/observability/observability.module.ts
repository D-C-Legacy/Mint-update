import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from '../../shared/errors/global-exception.filter';
import { ResponseEnvelopeInterceptor } from '../http/response-envelope.interceptor';
import { WsObservabilityInterceptor } from './ws-observability.interceptor';
import { MetricsController } from './metrics.controller';

// First use of NestJS's `APP_FILTER`/`APP_INTERCEPTOR` DI tokens in this codebase — supersedes
// P9-01's `app.useGlobalFilters(new RateLimitedExceptionFilter())` pattern (a hand-constructed
// instance with no dependencies) specifically because `GlobalExceptionFilter` needs
// `LoggerService` constructor-injected, which only the DI-token registration style supports.
// Both apply globally to every process that imports `AppModule` (all 3) — inert where there's no
// HTTP surface to catch exceptions on (the worker process), harmless, same "runs everywhere,
// no-op where irrelevant" precedent as every other shared-AppModule module.
@Module({
  controllers: [MetricsController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    WsObservabilityInterceptor,
  ],
  exports: [WsObservabilityInterceptor],
})
export class ObservabilityModule {}
