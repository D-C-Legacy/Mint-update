# Technical Requirements Document

**Last updated:** 2026-09-29

---

## 1. Stack

### Runtime and language

| Choice     | Version | Why                                                        |
| ---------- | ------- | ---------------------------------------------------------- |
| Node.js    | 22 LTS  | Long support window, stable perf                           |
| TypeScript | 5.6+    | `strict: true`, no implicit any, no unchecked index access |
| pnpm       | 9+      | Fast, strict node_modules, good for a large single repo    |

### Framework

| Choice                             | Why                                                                                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NestJS 10 with Fastify adapter** | Module system maps one to one onto bounded contexts, which is exactly what keeps a large codebase navigable and keeps a coding agent from losing its place. DI makes testing and swapping adapters trivial. Fastify adapter for throughput. |

> If you would rather run bare Fastify, the folder structure in `04-FOLDER-STRUCTURE.md` still applies. Nest is chosen because explicit module boundaries are load bearing here.

### Data

| Choice     | Version | Purpose                                |
| ---------- | ------- | -------------------------------------- |
| PostgreSQL | 16      | Source of truth                        |
| Prisma     | 5.20+   | ORM, migrations, typed client          |
| Redis      | 7       | Pub/sub, presence, rate limits, queues |
| ioredis    | 5       | Redis client, cluster ready            |

### Realtime

| Choice                   | Purpose                                         |
| ------------------------ | ----------------------------------------------- |
| Socket.IO 4              | WebSocket transport with fallback, rooms, acks  |
| @socket.io/redis-adapter | Cross-node fanout so any node serves any socket |

### Jobs

| Choice   | Purpose                                                              |
| -------- | -------------------------------------------------------------------- |
| BullMQ 5 | Delayed jobs (auction close), repeatable jobs (payout runs), retries |

### Money and media

| Choice          | Purpose                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| Stripe SDK      | Card processing only. Charges settle to the company account. Not Connect. |
| AWS SDK v3 (S3) | Media and document storage                                                |
| CloudFront      | Public media delivery                                                     |

### Video

| Choice                          | Purpose                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LiveKit Cloud **or** Amazon IVS | Low latency live streaming. Decision D-005.                                                                                                                                                                         |
| hls.js (web only)               | Chromium/Firefox have no native HLS support in `<video>`; parses the HLS manifest via MediaSource Extensions so IVS playback URLs render on web outside Safari. Safari keeps using its native HLS support directly. |

Abstracted behind `StreamProviderPort` so the choice is reversible.

### Supporting

| Choice              | Purpose                                      |
| ------------------- | -------------------------------------------- |
| Zod                 | Runtime validation at every boundary         |
| argon2              | Password hashing                             |
| Pino                | Structured logging                           |
| OpenTelemetry       | Tracing                                      |
| Sentry              | Error reporting                              |
| Vitest              | Unit and integration tests                   |
| Testcontainers      | Real Postgres and Redis in integration tests |
| ESLint + Prettier   | Lint and format                              |
| Husky + lint-staged | Pre-commit gate                              |

---

## 2. Hard technical rules

These are non-negotiable. Every code review checks them.

1. **Money is `BigInt` in minor units.** Never `number`, never `float`, never `Decimal` in application code. Prisma column type is `BigInt`.
2. **Every mutating money endpoint requires an `Idempotency-Key` header.** Stored, checked, replayed safely.
3. **Every cross-module call goes through a service facade.** No repository imports across modules.
4. **Every background job is idempotent.** Assume it will run twice.
5. **All input validated with Zod at the boundary.** Controllers and gateways never trust a payload.
6. **No business logic in controllers or gateways.** They parse, delegate, and serialize.
7. **Ledger entries are append only.** No `UPDATE`, no `DELETE`, ever.
8. **All timestamps are UTC `timestamptz`.** Formatting is the client's job.
9. **Soft delete only where an audit trail is needed.** Hard delete elsewhere to keep tables lean.
10. **Every domain event has a versioned name:** `sale.resolved.v1`.

---

## 3. Layering inside a module

```
module/
  api/          controllers, gateways, DTOs        (adapters in)
  application/  use cases, orchestration           (thin)
  domain/       entities, value objects, rules     (pure, no I/O)
  infra/        repositories, external adapters    (adapters out)
  events/       event definitions and handlers
  module.ts     Nest module wiring
```

**Dependency direction:** `api → application → domain`, and `infra` implements interfaces declared in `domain` or `application`. Domain imports nothing from the other three.

**Why:** the domain layer is where auction rules, increment tables and ledger invariants live. Keeping it pure means those rules are unit testable in milliseconds with no database.

---

## 4. Environments

| Env          | Purpose                                                           |
| ------------ | ----------------------------------------------------------------- |
| `local`      | Docker Compose: Postgres, Redis, MinIO. Stripe in test mode.      |
| `staging`    | Mirrors production. Seeded with realistic data. Load tested here. |
| `production` | Live                                                              |

Config via `.env`, validated by a Zod schema at boot. Missing or malformed variables crash the process immediately rather than failing at first use.

---

## 5. Testing requirements

| Layer                | Approach                                                    | Coverage target                         |
| -------------------- | ----------------------------------------------------------- | --------------------------------------- |
| Domain               | Pure unit tests, no I/O                                     | 90%+                                    |
| Application          | Unit with mocked ports                                      | 80%+                                    |
| Infra / repositories | Integration against Testcontainers Postgres                 | Key paths                               |
| API                  | Supertest against a booted app                              | Happy path + auth + validation failures |
| Realtime             | Socket.IO client harness, multi-node via two app instances  | Bid concurrency scenarios               |
| Load                 | k6 against staging: 5,000 viewers, 50 bids/s on one auction | Must meet NFRs in PRD §8                |

**Mandatory test cases before the sale engine is considered done:**

- Two simultaneous bids at the same amount, only one wins
- Bid arriving 50ms before expiry extends the timer
- Bid arriving after expiry is rejected
- Extension cap is enforced
- Buy now with stock of 1 and two simultaneous buyers, exactly one order
- Payment webhook delivered twice creates one ledger effect
- Payout run executed twice transfers once

---

## 6. Security requirements

| Area             | Requirement                                                                          |
| ---------------- | ------------------------------------------------------------------------------------ |
| Passwords        | argon2id, per-user salt                                                              |
| Tokens           | Short-lived access, rotating refresh with reuse detection                            |
| Seller documents | Private bucket, SSE-KMS, signed URLs with 60s expiry, every access logged            |
| PII              | Encrypted at rest. Access to document endpoints restricted to admin role and logged. |
| Webhooks         | Signature verified. Stripe and video provider. Replay window enforced.               |
| Rate limits      | Auth endpoints, bid placement, chat messages, offer submission                       |
| Admin actions    | Every approve, reject, refund, hold and adjustment written to an audit log           |
| Secrets          | Never in the repo. Parameter Store or equivalent.                                    |

---

## 7. Observability requirements

Must be in place before the first live stream with real money:

- Request id on every log line, propagated into WS and jobs
- Metrics: bid latency histogram, WS connections, room count, queue depth, job failure rate
- Alerts: queue depth over threshold, job failure rate, ledger reconciliation mismatch, payment webhook lag
- A daily reconciliation job that compares ledger totals against processor and bank records, and alerts on any difference

---

## 8. Performance budgets

| Operation                        | Budget                    |
| -------------------------------- | ------------------------- |
| Bid validate and persist         | under 40ms p95            |
| Bid accepted to fanout published | under 60ms p95            |
| Fanout to client receipt         | under 200ms p95           |
| Chat message end to end          | under 250ms p95           |
| Catalog read endpoints           | under 150ms p95           |
| Auction close job execution      | within 250ms of `ends_at` |

---

## 9. Repository conventions

- Conventional commits: `feat(sales): add anti-snipe extension`
- Branch per ticket: `feat/SALES-04-anti-snipe`
- One ticket, one PR, small diff
- PR template requires: ticket id, what changed, tests added, invariants touched
- CI must pass: typecheck, lint, unit, integration
