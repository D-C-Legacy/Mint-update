import { env } from './env';

export const ordersConfig = Object.freeze({
  // Placeholder, same treatment the bid-increment and offer-expiry placeholders got before
  // founder confirmation (P5-02/P5-08) — 00-PRD.md §4.4 step 3 says "auto-confirm after N days"
  // without ever giving N a real number. 7 days is a guess fitting a typical delivery window,
  // not a product decision. Flag before relying on this in production.
  autoConfirmDeliveryDays: env.ORDER_AUTO_CONFIRM_DAYS,
});

export type OrdersConfig = typeof ordersConfig;
