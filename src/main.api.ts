process.env.SERVICE_NAME = 'api';
import './platform/observability/tracing';
import 'reflect-metadata';
import './shared/money/bigint-json';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import { registerRawBodyCapture } from './platform/webhooks/raw-body-content-parser';
import { registerFormBodyParser } from './platform/http/form-body-content-parser';
import { registerRequestContext } from './platform/logger/request-id.middleware';
import { LoggerService } from './platform/logger/logger.service';
import { initSentry } from './platform/observability/sentry';
import { applyApiPrefix } from './platform/http/api-prefix';

initSentry('api');

async function bootstrap(): Promise<void> {
  // `bodyParser: false` stops Nest from registering its own default `application/json` parser —
  // it would otherwise collide with `registerRawBodyCapture`'s own parser for the same content
  // type ("Content type parser 'application/json' already present", found live). Our own parser
  // replaces it exactly, every existing route's `@Body()` keeps working unchanged.
  // `bufferLogs: true` holds Nest's own bootstrap log lines (NestFactory, InstanceLoader, ...)
  // until `app.useLogger()` below replaces the default console logger, so even those go through
  // the real structured Pino output instead of being lost to the default logger first.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bodyParser: false,
    bufferLogs: true,
  });
  app.useLogger(app.get(LoggerService));
  app.enableCors({ origin: appConfig.corsOrigin });
  registerRawBodyCapture(app);
  registerFormBodyParser(app);
  // 01-ARCHITECTURE.md: "request id... on every log line" — must run before any guard/handler
  // that reads `getRequestContext()`. `GlobalExceptionFilter`/`ResponseEnvelopeInterceptor` (the
  // former superseding P9-01's `RateLimitedExceptionFilter`) are now registered via the
  // `APP_FILTER`/`APP_INTERCEPTOR` DI tokens in `ObservabilityModule`, not here.
  registerRequestContext(app);
  applyApiPrefix(app);
  await app.listen(appConfig.apiPort, '0.0.0.0');
}

void bootstrap();
