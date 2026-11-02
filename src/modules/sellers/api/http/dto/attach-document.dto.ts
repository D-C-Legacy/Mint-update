import { z } from 'zod';
import { DocumentTypeSchema } from './request-upload-url.dto';

export const AttachDocumentSchema = z.object({
  type: DocumentTypeSchema,
  storageKey: z.string().min(1).max(1024),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
});

export type AttachDocumentDto = z.infer<typeof AttachDocumentSchema>;
