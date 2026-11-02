import { z } from 'zod';

export const AddModeratorSchema = z.object({
  userId: z.string().min(1),
});

export type AddModeratorDto = z.infer<typeof AddModeratorSchema>;

export const RemoveModeratorSchema = z.object({
  moderatorId: z.string().min(1),
});

export type RemoveModeratorDto = z.infer<typeof RemoveModeratorSchema>;

export const TimeoutUserSchema = z.object({
  userId: z.string().min(1),
  durationMinutes: z.coerce.number().int().positive().max(10080), // max 1 week
  reason: z.enum(['SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'OTHER']).default('OTHER'),
});

export type TimeoutUserDto = z.infer<typeof TimeoutUserSchema>;

export const ListModeratorsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type ListModeratorsQueryDto = z.infer<typeof ListModeratorsQuerySchema>;

export const ListTimeoutsQuerySchema = z.object({
  userId: z.string().optional(),
  activeOnly: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type ListTimeoutsQueryDto = z.infer<typeof ListTimeoutsQuerySchema>;
