import * as Sentry from '@sentry/node';
import { observabilityConfig } from '../../config/observability.config';

// No doc anywhere names a real Sentry project/DSN — same "no real credentials in this
// environment" treatment as Stripe/Resend/LiveKit: wired for real, disabled (a clean no-op) when
// `SENTRY_DSN` isn't set, rather than mocked. `initSentry` must run once, early, in each
// `main.*.ts` (after tracing.ts, order doesn't matter relative to it) — before anything that
// might throw during its own bootstrap.
let enabled = false;

export function initSentry(serviceName: string): void {
  if (!observabilityConfig.sentryDsn) {
    return;
  }
  Sentry.init({
    dsn: observabilityConfig.sentryDsn,
    environment: process.env.NODE_ENV,
    serverName: serviceName,
  });
  enabled = true;
}

export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!enabled) {
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
