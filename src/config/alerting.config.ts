import { env } from './env';

export const alertingConfig = Object.freeze({
  emailTo: env.ALERT_EMAIL_TO,
  sweepIntervalMs: env.ALERT_SWEEP_INTERVAL_MS,
  cooldownMinutes: env.ALERT_COOLDOWN_MINUTES,
  queueDepthThreshold: env.ALERT_QUEUE_DEPTH_THRESHOLD,
  jobFailureThreshold: env.ALERT_JOB_FAILURE_THRESHOLD,
  jobFailureWindowMinutes: env.ALERT_JOB_FAILURE_WINDOW_MINUTES,
  webhookLagThresholdSeconds: env.ALERT_WEBHOOK_LAG_THRESHOLD_SECONDS,
  bidLatencyP95Seconds: env.ALERT_BID_LATENCY_P95_SECONDS,
});

export type AlertingConfig = typeof alertingConfig;
