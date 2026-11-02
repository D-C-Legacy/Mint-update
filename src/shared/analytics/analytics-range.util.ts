// Moved here from modules/admin (P8-04's own analytics-range.util.ts) so a seller-scoped
// analytics equivalent (engineering-hardening backlog, Phase 2b) can reuse the exact same
// default-window resolution without Orders importing Admin (or vice versa) just for this one
// pure, stateless helper — same reasoning as every other cross-cutting pure utility in `shared/`.
//
// Default range: no doc gives a real default window for the analytics dashboard, same
// unresolved-number class as the bid increment/offer-expiry placeholders before founder
// confirmation — 30 days is a reasoned, flagged default, not a guess presented as settled.
export const DEFAULT_ANALYTICS_WINDOW_DAYS = 30;

export interface AnalyticsRangeCommand {
  readonly from: Date | undefined;
  readonly to: Date | undefined;
}

export function resolveAnalyticsRange(cmd: AnalyticsRangeCommand): { from: Date; to: Date } {
  const to = cmd.to ?? new Date();
  const from =
    cmd.from ?? new Date(to.getTime() - DEFAULT_ANALYTICS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { from, to };
}
