import { env } from './env';

export const appConfig = Object.freeze({
  nodeEnv: env.NODE_ENV,
  apiPort: env.API_PORT,
  realtimePort: env.REALTIME_PORT,
  corsOrigin: env.CORS_ORIGIN,
  publicRealtimeUrl: env.PUBLIC_REALTIME_URL ?? `ws://localhost:${env.REALTIME_PORT}`,
  publicAppUrl: env.PUBLIC_APP_URL ?? `http://localhost:8081`,
});

export type AppConfig = typeof appConfig;
