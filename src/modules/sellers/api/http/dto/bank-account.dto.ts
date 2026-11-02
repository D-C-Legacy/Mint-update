import { z } from 'zod';

export const BankAccountSchema = z.object({
  accountHolder: z.string().min(1).max(200),
  accountNumber: z.string().min(4).max(64),
  bankName: z.string().min(1).max(200).optional(),
  country: z.string().length(2),
  currency: z.string().length(3),
});

export type BankAccountDto = z.infer<typeof BankAccountSchema>;
