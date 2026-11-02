process.env.SERVICE_NAME = 'realtime';
import './platform/observability/tracing';
import 'reflect-metadata';
import './shared/money/bigint-json';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import { RedisIoAdapter } from './platform/realtime/redis-io.adapter';
import { registerRawBodyCapture } from './platform/webhooks/raw-body-content-parser';
import { registerRequestContext } from './platform/logger/request-id.middleware';
import { LoggerService } from './platform/logger/logger.service';
import { initSentry } from './platform/observability/sentry';
import { applyApiPrefix } from './platform/http/api-prefix';

initSentry('realtime');

async function bootstrap(): Promise<void> {
  // See main.api.ts for why `bodyParser: false`/`bufferLogs: true` are required alongside
  // `registerRawBodyCapture`/`app.useLogger`.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bodyParser: false,
    bufferLogs: true,
  });
  app.useLogger(app.get(LoggerService));
  app.enableCors({ origin: appConfig.corsOrigin });
  registerRawBodyCapture(app);
  // See main.api.ts — this process also serves AppModule's (small) HTTP surface, incl. /metrics.
  // `GlobalExceptionFilter`/`ResponseEnvelopeInterceptor` come from `ObservabilityModule`'s
  // `APP_FILTER`/`APP_INTERCEPTOR` providers now, not a manual `app.useGlobalFilters()` call.
  registerRequestContext(app);
  applyApiPrefix(app);

  const redisIoAdapter = new RedisIoAdapter(app);
  redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(appConfig.realtimePort, '0.0.0.0');
}

void bootstrap();
