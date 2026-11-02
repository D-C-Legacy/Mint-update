import { z } from 'zod';

export const EnvSchema = z
  .object({
    // app.config
    NODE_ENV: z.enum(['local', 'staging', 'production']).default('local'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    REALTIME_PORT: z.coerce.number().int().positive().default(3001),
    CORS_ORIGIN: z.string().default('*'),
    // Public https:// URL the web app is reachable at from outside — used in emails for
    // invitation accept links. Falls back to a local dev URL when unset.
    PUBLIC_APP_URL: z.string().url().optional(),
    // Public wss:// URL the realtime server is actually reachable at from outside — distinct from
    // REALTIME_PORT (the port the process binds to), needed because the public address usually
    // goes through a reverse proxy/domain, not host:port directly. Returned in
    // POST /streams/:id/start's response (05-API-SPEC.md §6 `wsUrl` field). Falls back to a plain
    // local ws:// URL when unset, which is correct for local dev but not for any real deployment.
    PUBLIC_REALTIME_URL: z.string().optional(),

    // database.config
    DATABASE_URL: z.string().url(),

    // redis.config
    REDIS_URL: z.string().url(),

    // auth.config
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_REFRESH_TTL: z.string().default('30d'),
    ARGON2_MEMORY_COST: z.coerce.number().int().positive().default(19456),
    ARGON2_TIME_COST: z.coerce.number().int().positive().default(2),
    ARGON2_PARALLELISM: z.coerce.number().int().positive().default(1),

    // oauth.config — Google/Apple sign-in, added 25 Oct 2026. All optional: no real credentials
    // from the founder yet. Unset means OAuthProviderNotConfiguredError, not a boot crash — this
    // is the whole point of building the flow now (flipping it on later is a config change).
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().url().optional(),
    // Audience for a native-app Google id_token, distinct from the web client id above.
    GOOGLE_IOS_CLIENT_ID: z.string().optional(),
    APPLE_SERVICES_ID: z.string().optional(),
    APPLE_TEAM_ID: z.string().optional(),
    APPLE_KEY_ID: z.string().optional(),
    APPLE_PRIVATE_KEY: z.string().optional(),
    APPLE_REDIRECT_URI: z.string().url().optional(),
    // Audience for a native-app Apple identityToken, distinct from the Services ID above.
    APPLE_BUNDLE_ID: z.string().optional(),

    // stripe.config
    STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
    STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),

    // storage.config
    AWS_REGION: z.string().default('us-east-1'),
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    S3_ENDPOINT: z.string().url().optional(),
    S3_PUBLIC_BUCKET: z.string(),
    S3_PRIVATE_BUCKET: z.string(),
    CDN_DOMAIN: z.string(),
    // Scheme for public media URLs (getPublicUrl). https in production (CDN); set to http for a
    // local MinIO endpoint, whose plain-HTTP URL is unreachable if this stays https.
    PUBLIC_MEDIA_SCHEME: z.enum(['http', 'https']).default('https'),

    // stream.config — D-005 open, provider selected at runtime via env
    STREAM_PROVIDER: z.enum(['livekit', 'ivs']),
    LIVEKIT_URL: z.string().url().optional(),
    LIVEKIT_API_KEY: z.string().optional(),
    LIVEKIT_API_SECRET: z.string().optional(),
    IVS_REGION: z.string().optional(),
    IVS_ACCESS_KEY_ID: z.string().optional(),
    IVS_SECRET_ACCESS_KEY: z.string().optional(),

    // sales.config — values per 00-PRD.md (duration) and 06-REALTIME-AND-CONCURRENCY.md §5 (anti-snipe)
    DEFAULT_AUCTION_DURATION_SECONDS: z.coerce.number().int().positive().default(30),
    ANTI_SNIPE_WINDOW_SECONDS: z.coerce.number().int().positive().default(10),
    ANTI_SNIPE_EXTEND_SECONDS: z.coerce.number().int().positive().default(10),
    ANTI_SNIPE_MAX_EXTENSIONS: z.coerce.number().int().nonnegative().default(20),
    // Placeholder default (P5-08) — no doc gives a real offer response window.
    OFFER_EXPIRY_SECONDS: z.coerce.number().int().positive().default(300),

    // orders.config — placeholder default (P6-08): 00-PRD.md §4.4 step 3 literally says
    // "auto-confirm after N days" without ever giving N a real value.
    ORDER_AUTO_CONFIRM_DAYS: z.coerce.number().int().positive().default(7),

    // email.config (P8-03) — no doc names an email provider at all (same gap as P8-02's push
    // SDK); user chose Resend. RESEND_FROM_EMAIL defaults to Resend's own sandbox sender, which
    // works with zero setup but only delivers to the account's own verified test addresses —
    // flagged placeholder until a real sending domain is verified in Resend.
    RESEND_API_KEY: z.string().min(1),
    RESEND_FROM_EMAIL: z.string().email().default('onboarding@resend.dev'),

    // observability.config (P9-03) — SENTRY_DSN optional: no doc names a real Sentry project,
    // same "no real credentials in this environment" treatment as Stripe/Resend/LiveKit. Sentry
    // stays a clean no-op without it rather than being mocked. WORKER_METRICS_PORT exists because
    // main.worker.ts has no Fastify/HTTP server at all (NestFactory.createApplicationContext) —
    // api/realtime expose /metrics as an ordinary route on their existing port instead.
    SENTRY_DSN: z.string().url().optional(),
    WORKER_METRICS_PORT: z.coerce.number().int().positive().default(9095),

    // alerting.config (P9-04) — delivery channel (user decision, this session): email via the
    // already-integrated Resend adapter. ALERT_EMAIL_TO optional: unset means alerts are still
    // evaluated and logged at CRITICAL, just not emailed — same "wired for real, no-op without
    // config" treatment as SENTRY_DSN. Every threshold below except the bid-latency one is a
    // placeholder default (no doc gives a real number) — flagged, same class as the bid increment
    // before founder confirmation, the offer-expiry window, and the auto-confirm-delivery days.
    // ALERT_BID_LATENCY_P95_SECONDS *is* doc-given: 02-TRD.md §8, "Bid validate and persist" p95
    // budget is 40ms.
    ALERT_EMAIL_TO: z.string().email().optional(),
    ALERT_SWEEP_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
    ALERT_COOLDOWN_MINUTES: z.coerce.number().int().positive().default(15),
    ALERT_QUEUE_DEPTH_THRESHOLD: z.coerce.number().int().positive().default(500),
    ALERT_JOB_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
    ALERT_JOB_FAILURE_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
    ALERT_WEBHOOK_LAG_THRESHOLD_SECONDS: z.coerce.number().int().positive().default(300),
    ALERT_BID_LATENCY_P95_SECONDS: z.coerce.number().positive().default(0.04),

    // account-deletion.config — Apple App Store guideline 5.1.1(v) requires in-app account
    // deletion. 14-day grace period and 3-day-before reminder are the user's own choice (28 Oct
    // 2026), not from a doc, same "flagged, not a doc number" treatment as the other placeholders
    // above.
    ACCOUNT_DELETION_GRACE_DAYS: z.coerce.number().int().positive().default(14),
    ACCOUNT_DELETION_REMINDER_DAYS_BEFORE: z.coerce.number().int().nonnegative().default(3),
  })
  .superRefine((val, ctx) => {
    if (val.STREAM_PROVIDER === 'livekit') {
      (['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'] as const).forEach((key) => {
        if (!val[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STREAM_PROVIDER=livekit`,
          });
        }
      });
    }
    if (val.STREAM_PROVIDER === 'ivs') {
      (['IVS_REGION', 'IVS_ACCESS_KEY_ID', 'IVS_SECRET_ACCESS_KEY'] as const).forEach((key) => {
        if (!val[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STREAM_PROVIDER=ivs`,
          });
        }
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;
