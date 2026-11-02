// AGENTS.md §4: money is integer minor units (cents) everywhere in this backend. Formats for
// display and converts a typed dollar amount back to minor units for a request body.
export function formatMoney(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minorUnits / 100);
}

export function dollarsToMinorUnits(input: string): number {
  return Math.round(Number(input) * 100);
}
