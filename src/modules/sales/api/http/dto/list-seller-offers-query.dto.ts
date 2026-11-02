import { z } from 'zod';

const OFFER_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'COUNTERED',
  'EXPIRED',
  'WITHDRAWN',
] as const;

// One filter per call, comma-separated: status=ACCEPTED,COUNTERED. A plain string + split is
// deliberate — repeated query params arrive as arrays only under some adapters, so parsing one
// string here keeps the route's contract simple, and a bad value 400s rather than silently
// matching nothing downstream like an in: [] clause would.
const StatusListSchema = z
  .string()
  .refine(
    (raw) => {
      const values = raw.split(',').map((part) => part.trim());
      return (
        values.length > 0 &&
        values.every((value) => (OFFER_STATUSES as readonly string[]).includes(value))
      );
    },
    {
      message: `status must be a comma-separated list of: ${OFFER_STATUSES.join(', ')}`,
    },
  )
  .transform(
    (raw) => raw.split(',').map((part) => part.trim()) as (typeof OFFER_STATUSES)[number][],
  );

// Defaults to no status filter (all statuses) at the query layer; the route applies its own
// opinion (PENDING when the param is absent — the actionable inbox, user decision 17 Oct 2026).
export const ListSellerOffersQuerySchema = z.object({
  status: StatusListSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type ListSellerOffersQueryDto = z.infer<typeof ListSellerOffersQuerySchema>;
