import { env } from './env';

export const stripeConfig = Object.freeze({
  secretKey: env.STRIPE_SECRET_KEY,
  webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  // Public by design (it ships to browsers); the secret key never leaves the server.
  publishableKey: env.STRIPE_PUBLISHABLE_KEY,
});

export type StripeConfig = typeof stripeConfig;
