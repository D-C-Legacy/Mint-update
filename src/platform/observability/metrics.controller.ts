import { Controller, Get, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { renderMetrics } from './metrics';

// On the API/realtime processes, a plain route on their existing Fastify port — Prometheus'
// pull model needs no auth/rate-limit/idempotency guard here (same "ops surface, not product
// surface" treatment as HealthController). The worker process has no Fastify server at all
// (`main.worker.ts` uses `NestFactory.createApplicationContext`), so this controller is
// registered but inert there — `main.worker.ts` instead serves `/metrics` from a small bare
// `http` server calling the exact same `renderMetrics()` function, no duplicated logic.
@Controller()
export class MetricsController {
  @Get('metrics')
  async metrics(@Res({ passthrough: true }) res: FastifyReply): Promise<string> {
    const { contentType, body } = await renderMetrics();
    res.header('Content-Type', contentType);
    return body;
  }
}
