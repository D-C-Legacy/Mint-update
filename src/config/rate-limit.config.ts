// 05-API-SPEC.md §13's limits, reproduced verbatim as a literal table rather than env-driven
// tunables — same convention as sales.config.ts's BID_INCREMENT_BANDS: these are documented
// product numbers, not infra knobs, so there's nothing for an operator to configure per-deploy.
// `capacity` is the token-bucket's burst size (and the limit's own numerator); `refillPerSecond`
// is capacity divided by the window, so the bucket fully refills exactly once per window.
export interface RateLimitRule {
  readonly capacity: number;
  readonly refillPerSecond: number;
}

export const rateLimitConfig = {
  // 5 per 15 min per IP + email.
  login: { capacity: 5, refillPerSecond: 5 / (15 * 60) },
  // 3 per hour per IP.
  register: { capacity: 3, refillPerSecond: 3 / 3600 },
  // Not in 05-API-SPEC.md §13 — added 24 Oct 2026 on explicit instruction once the verification
  // token became a 6-digit code (previously a JWT, where guessing wasn't a realistic concern).
  // 10 per 15 min per IP: the code itself already expires in 15 min, so this caps any single
  // code's entire guessable lifetime at 10 attempts against 1,000,000 possibilities.
  verifyEmail: { capacity: 10, refillPerSecond: 10 / (15 * 60) },
  // Not in 05-API-SPEC.md §13 — OAuth isn't in the docs at all. Added 25 Oct 2026 alongside
  // Google/Apple sign-in. 10 per 15 min per IP: generous for real retries, tight enough to bound
  // JWKS-verification cost per IP, same reasoning as verifyEmail above.
  oauth: { capacity: 10, refillPerSecond: 10 / (15 * 60) },
  // 5/sec per user (WS or HTTP) — place-bid, keyed by bidderUserId regardless of transport.
  bid: { capacity: 5, refillPerSecond: 5 },
  // 3/sec per user — chat.send, already built in P4-06, generalized into this table here.
  chat: { capacity: 3, refillPerSecond: 3 },
  // 2/sec per user — submit-offer and respond-to-offer alike (the doc names one "Offer" scope,
  // not a separate one per action).
  offer: { capacity: 2, refillPerSecond: 2 },
  // 20/min per user — every presigned-upload-URL endpoint (product images, seller documents).
  uploadUrl: { capacity: 20, refillPerSecond: 20 / 60 },
  // 100/min per user — the catch-all for every other authenticated HTTP route and WS message
  // that doesn't have a more specific scope above.
  defaultAuthenticated: { capacity: 100, refillPerSecond: 100 / 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitScope = keyof typeof rateLimitConfig;
