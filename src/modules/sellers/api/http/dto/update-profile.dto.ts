import { z } from 'zod';

// 05-API-SPEC.md says "display name, bio" — there is no `bio` column anywhere on Seller
// (03-DATA-MODEL.md §3), so only displayName is real. See MEMORY.md.
export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
});

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
