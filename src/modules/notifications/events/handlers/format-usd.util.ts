// Shared by this ticket's handlers that render a money amount — `shared/money/` has no
// display-formatting helper (only arithmetic), and this codebase is single-currency USD-only
// (shared/money/currency.ts), so a self-contained cents->dollars format is enough here without
// inventing a new shared formatting utility beyond what these templates need.
export function formatUsdMinorUnits(amountMinorUnits: string): string {
  return `$${(Number(amountMinorUnits) / 100).toFixed(2)}`;
}
