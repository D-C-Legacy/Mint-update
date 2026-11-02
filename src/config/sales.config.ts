import { env } from './env';

// Founder decision, 2026-10-01: flat $1 minimum increment at every price level (no price
// bands requested). Kept as a bands table, not a scalar, so real bands can be added later
// without changing the rule or its callers — only this literal would need to grow. Shape
// matches modules/sales/domain/rules/increment.rule.ts's IncrementBand, structurally —
// config must not import from a module's domain/ (that's backward; see AGENTS.md §4).
const BID_INCREMENT_BANDS = [{ minAmount: 0n, incrementAmount: 100n }] as const;

export const salesConfig = Object.freeze({
  defaultAuctionDurationSeconds: env.DEFAULT_AUCTION_DURATION_SECONDS,
  antiSnipe: {
    windowSeconds: env.ANTI_SNIPE_WINDOW_SECONDS,
    extendBySeconds: env.ANTI_SNIPE_EXTEND_SECONDS,
    maxExtensions: env.ANTI_SNIPE_MAX_EXTENSIONS,
  },
  bidIncrementBands: BID_INCREMENT_BANDS,
  // Placeholder, same treatment the bid increment table got before founder confirmation
  // (P5-02) — no doc anywhere gives a real offer response window. 5 minutes is a guess fitting
  // a live-stream pace, not a product decision. Flag before relying on this in production.
  offerExpirySeconds: env.OFFER_EXPIRY_SECONDS,
});

export type SalesConfig = typeof salesConfig;
