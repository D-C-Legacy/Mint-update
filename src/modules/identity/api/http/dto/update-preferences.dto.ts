import { z } from 'zod';

const NotificationsPatch = z
  .object({
    live: z.boolean(),
    bids: z.boolean(),
    orders: z.boolean(),
    messages: z.boolean(),
  })
  .partial()
  .strict();

const PrivacyPatch = z
  .object({
    publicProfile: z.boolean(),
    showActivity: z.boolean(),
    onlineStatus: z.boolean(),
  })
  .partial()
  .strict();

// A patch: send only what changed. An empty body is rejected so a typo cannot silently do nothing.
export const UpdatePreferencesSchema = z
  .object({
    notifications: NotificationsPatch.optional(),
    privacy: PrivacyPatch.optional(),
  })
  .strict()
  .refine(
    (v) => Object.keys(v.notifications ?? {}).length > 0 || Object.keys(v.privacy ?? {}).length > 0,
    { message: 'Send at least one preference to change' },
  );

export type UpdatePreferencesDto = z.infer<typeof UpdatePreferencesSchema>;
