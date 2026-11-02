import { z } from 'zod';

// Shared by every `GET .../analytics/*` route that takes an optional date range — admin's and
// every seller-scoped mirror of it (engineering-hardening backlog, Phase 2). Moved here from
// modules/admin for the same reason as its sibling `analytics-range.util.ts`: avoid duplicating
// (or cross-importing between unrelated modules for) one small, module-agnostic validation shape.
//
// `granularity` only accepts 'day' in v1 — whether week/month bucketing is actually needed is an
// open question (see admin_progress.md's "Analytics time granularity" decision), deliberately
// left unresolved rather than guessed. Accepting only 'day' here makes that gap explicit (a 400,
// not a silently-ignored param) instead of claiming support that isn't built.
export const AnalyticsRangeQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  granularity: z.literal('day').optional(),
});

export type AnalyticsRangeQueryDto = z.infer<typeof AnalyticsRangeQuerySchema>;
