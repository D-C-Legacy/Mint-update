import { z } from 'zod';

// Same field rules as the per-order address (orders/api/http/dto/set-shipping-address.dto.ts).
const line2 = z.string().trim().min(1).max(200);

export const CreateAddressSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    line1: z.string().trim().min(1).max(200),
    line2: line2.optional(),
    city: z.string().trim().min(1).max(100),
    region: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().min(1).max(20),
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    isDefault: z.boolean().optional(),
  })
  .strict();

export type CreateAddressDto = z.infer<typeof CreateAddressSchema>;

// A patch. `line2: null` clears the second line. `isDefault` can only be set to true.
export const UpdateAddressSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    line1: z.string().trim().min(1).max(200),
    line2: line2.nullable(),
    city: z.string().trim().min(1).max(100),
    region: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().min(1).max(20),
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    isDefault: z.literal(true),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Send at least one field to change' });

export type UpdateAddressDto = z.infer<typeof UpdateAddressSchema>;
