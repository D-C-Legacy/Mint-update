import { env } from './env';

export const emailConfig = Object.freeze({
  resend: {
    apiKey: env.RESEND_API_KEY,
    fromEmail: env.RESEND_FROM_EMAIL,
  },
});

export type EmailConfig = typeof emailConfig;
