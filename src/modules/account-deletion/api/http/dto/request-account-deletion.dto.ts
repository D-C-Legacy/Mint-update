import { z } from 'zod';

// The client's "type DELETE to confirm" step — re-validated server-side rather than trusted
// client-only, same "no business decision happens only on the client" instinct as every other
// confirmation in this codebase.
export const RequestAccountDeletionSchema = z.object({
  confirm: z.literal('DELETE'),
});

export type RequestAccountDeletionDto = z.infer<typeof RequestAccountDeletionSchema>;
