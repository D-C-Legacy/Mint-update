import { z } from 'zod';

// Approved field set (seven fields). countryCode is ISO 3166-1 alpha-2; which countries are
// supported is still open (09-DECISIONS.md D-004), so only the format is enforced here.
export const SetShippingAddressSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().min(1).max(200).optional(),
  city: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
});

export type SetShippingAddressDto = z.infer<typeof SetShippingAddressSchema>;
