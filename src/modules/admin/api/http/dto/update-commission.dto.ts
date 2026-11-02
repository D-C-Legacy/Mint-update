import { z } from 'zod';

export const UpdateCommissionSchema = z.object({
  // 0-10000 bps (0%-100%) — no doc gives a valid range; P7-04 already confirmed 0 and 10000 are
  // both legitimate edge cases for this field, so the bound is the field's own natural domain.
  commissionBps: z.number().int().min(0).max(10000),
});

export type UpdateCommissionDto = z.infer<typeof UpdateCommissionSchema>;
