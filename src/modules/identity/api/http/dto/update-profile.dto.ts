import { z } from 'zod';

// Loose E.164: optional leading +, 8-15 digits total, no leading zero. Matches the frontend's own
// validPhone() in utils/auth.ts — keep the two in step.
const PHONE_PATTERN = /^\+?[1-9]\d{7,14}$/;

export const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  // Omit to leave the avatar unchanged, a string to set it (a key minted by
  // RequestAvatarUploadUseCase), or null to clear it.
  avatarKey: z.string().min(1).max(1024).nullable().optional(),
  // Omit to leave the phone number unchanged, a string to set it, or null to clear it. No SMS
  // verification (that's a separate, bigger feature) — this is stored as given, uniqueness-checked
  // against other users the same way email already is.
  phone: z
    .string()
    .trim()
    .regex(PHONE_PATTERN, 'Enter a valid phone number.')
    .nullable()
    .optional(),
});

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
