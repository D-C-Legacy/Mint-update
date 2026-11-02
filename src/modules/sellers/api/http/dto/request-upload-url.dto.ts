import { z } from 'zod';

export const DocumentTypeSchema = z.enum([
  'GOVERNMENT_ID',
  'PROOF_OF_ADDRESS',
  'BUSINESS_REGISTRATION',
  'TAX_DOCUMENT',
  'OTHER',
]);

export const RequestUploadUrlSchema = z.object({
  type: DocumentTypeSchema,
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
});

export type RequestUploadUrlDto = z.infer<typeof RequestUploadUrlSchema>;
