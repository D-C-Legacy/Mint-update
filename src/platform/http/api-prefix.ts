import { NestFastifyApplication } from '@nestjs/platform-fastify';

export const API_PREFIX = 'v1';

// Health and metrics stay at fixed, unversioned addresses for load balancers and Prometheus.
export function applyApiPrefix(app: NestFastifyApplication): void {
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health/ready', 'metrics'] });
}
