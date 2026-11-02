import { env } from './env';

export const streamConfig = Object.freeze({
  provider: env.STREAM_PROVIDER,
  livekit: {
    url: env.LIVEKIT_URL,
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
  },
  ivs: {
    region: env.IVS_REGION,
    accessKeyId: env.IVS_ACCESS_KEY_ID,
    secretAccessKey: env.IVS_SECRET_ACCESS_KEY,
  },
});

export type StreamConfig = typeof streamConfig;
