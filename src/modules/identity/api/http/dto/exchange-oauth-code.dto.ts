import { z } from 'zod';

export const ExchangeOAuthCodeSchema = z.object({
  code: z.string().min(1),
});

export type ExchangeOAuthCodeDto = z.infer<typeof ExchangeOAuthCodeSchema>;
