import { env } from './env';

export const storageConfig = Object.freeze({
  region: env.AWS_REGION,
  accessKeyId: env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  endpoint: env.S3_ENDPOINT,
  publicBucket: env.S3_PUBLIC_BUCKET,
  privateBucket: env.S3_PRIVATE_BUCKET,
  cdnDomain: env.CDN_DOMAIN,
  publicUrlScheme: env.PUBLIC_MEDIA_SCHEME,
});

export type StorageConfig = typeof storageConfig;
