// The dataviz skill's validated default categorical palette (8 hues, light mode — this app has
// no dark mode yet). Used as-is, order unchanged, so it keeps the skill's own CVD-safety proof
// (worst adjacent Delta E 9.1, well clear of the >=8 target) — never reordered per chart.
export const CATEGORICAL = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
];

// Two single-series line charts shown together get slot 1 and slot 2 ("the second takes the next
// categorical slot's hue") rather than both defaulting to the same sequential blue.
export const SEQUENTIAL_PRIMARY = CATEGORICAL[0];
export const SEQUENTIAL_SECONDARY = CATEGORICAL[1];

// Chart chrome, from the skill's reference palette (light mode).
export const CHART_INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  surface: '#fcfcfb',
};

// Fixed order per enum — never re-sorted by value, so a status keeps its color across charts.
const ORDER_STATUS_ORDER = [
  'PENDING_PAYMENT',
  'PAID',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
  'DISPUTED',
];
const PAYOUT_STATUS_ORDER = ['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'REVERSED', 'HELD'];
const SELLER_STATUS_ORDER = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'];

function colorFor(order: string[], status: string): string {
  const index = order.indexOf(status);
  return CATEGORICAL[index >= 0 ? index % CATEGORICAL.length : CATEGORICAL.length - 1];
}

export const orderStatusColor = (status: string): string => colorFor(ORDER_STATUS_ORDER, status);
export const payoutStatusColor = (status: string): string => colorFor(PAYOUT_STATUS_ORDER, status);
export const sellerStatusColor = (status: string): string => colorFor(SELLER_STATUS_ORDER, status);
