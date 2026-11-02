import { env } from './env';

export const observabilityConfig = Object.freeze({
  sentryDsn: env.SENTRY_DSN,
  workerMetricsPort: env.WORKER_METRICS_PORT,
});

export type ObservabilityConfig = typeof observabilityConfig;
