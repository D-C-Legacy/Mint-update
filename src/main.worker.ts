process.env.SERVICE_NAME = 'worker';
import './platform/observability/tracing';
import 'reflect-metadata';
import './shared/money/bigint-json';
import { createServer } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from './platform/logger/logger.service';
import { initSentry } from './platform/observability/sentry';
import { renderMetrics } from './platform/observability/metrics';
import { observabilityConfig } from './config/observability.config';

initSentry('worker');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(LoggerService));

  // This process has no Fastify/HTTP server at all (`createApplicationContext`, no transport) —
  // `MetricsController` (registered on every process via the shared `AppModule`/
  // `ObservabilityModule`) is simply inert here, same as every other controller class that exists
  // in this process's DI container without ever being reachable over HTTP. A bare `http` server,
  // not a second Fastify/Nest stack, is all `/metrics` needs — calling the exact same
  // `renderMetrics()` function the API/realtime processes' route handler calls.
  const server = createServer((req, res) => {
    if (req.url !== '/metrics') {
      res.writeHead(404).end();
      return;
    }
    void renderMetrics().then(({ contentType, body }) => {
      res.writeHead(200, { 'Content-Type': contentType }).end(body);
    });
  });
  server.listen(observabilityConfig.workerMetricsPort, '0.0.0.0');
}

void bootstrap();
