# Implementation Plan

**Last updated:** 2026-09-29

Divide and conquer. Every ticket is sized so a coding agent can complete it with **one module folder plus one or two docs in context**, and never the whole codebase.

---

## How to use this with an agent

For each ticket, the prompt is:

```
Read: docs/08-AGENT-GUIDE.md, docs/04-FOLDER-STRUCTURE.md
Also read: <the "Context" docs listed on the ticket>
Work only inside: <the "Touches" paths listed on the ticket>

Ticket: <id> <title>
<paste the Deliverables and Acceptance blocks>

Output snippets only: for each file, give the full path, the code, and a
one or two line note on what it does. Do not create or modify files yourself.
```

**Never give an agent two tickets at once.** Context bleed is what produces the sprawling, half-wired code you end up rewriting.

---

## Phase overview

| Phase | Name | Tickets | Blocks |
|---|---|---|---|
| **P0** | Skeleton | 6 | Everything |
| **P1** | Identity and access | 5 | P2, P3 |
| **P2** | Sellers and verification | 6 | P4 |
| **P3** | Catalog and channels | 5 | P4 |
| **P4** | Streaming and rooms | 6 | P5 |
| **P5** | Sale engine | 9 | P6 |
| **P6** | Orders and payments | 8 | P7 |
| **P7** | Ledger and payouts | 8 | Launch |
| **P8** | Notifications and admin | 6 | Launch |
| **P9** | Hardening | 6 | Launch |

**Total: 65 tickets.** P0 to P3 are fast. P5 and P7 are where the real difficulty is.

---

## P0 — Skeleton

> Context for all P0 tickets: `02-TRD.md`, `04-FOLDER-STRUCTURE.md`

| ID | Title | Touches | Deliverables |
|---|---|---|---|
| `P0-01` | Repo bootstrap | root | pnpm workspace, tsconfig strict, eslint with boundary rules, prettier, husky, vitest config |
| `P0-02` | Config module | `src/config/**` | Zod env schema, typed export, fail-fast boot validation |
| `P0-03` | Platform: database | `src/platform/database/**` | PrismaService, TransactionManager with `run<T>()`, DatabaseModule |
| `P0-04` | Platform: redis + queue | `src/platform/redis/**`, `src/platform/queue/**` | RedisService, PubSubService, LockService, QueueService, queue name registry |
| `P0-05` | Three entry points | `src/main.*.ts`, `src/app.module.ts` | api / realtime / worker bootstraps sharing AppModule, Dockerfile with 3 CMD targets, docker-compose with Postgres + Redis + MinIO |
| `P0-06` | Shared kernel | `src/shared/**` | Money BigInt helpers, Result type, DomainError base, error codes enum, ULID ids, Clock port, DomainEvent base, cursor pagination |

**Acceptance for P0:** `pnpm dev:api`, `pnpm dev:realtime`, `pnpm dev:worker` all boot against docker-compose. `/health/ready` returns 200.

---

## P1 — Identity and access

> Context: `03-DATA-MODEL.md` §2, `05-API-SPEC.md` §2

| ID | Title | Touches | Deliverables |
|---|---|---|---|
| `P1-01` | Identity schema | `prisma/schema/identity.prisma` | User, Session, Device models + enums + migration |
| `P1-02` | Password and token services | `src/platform/auth/**` | argon2id hashing, JWT sign/verify, refresh rotation with family reuse detection |
| `P1-03` | Auth use cases | `modules/identity/application/**` | register, login, refresh, logout, verify email, reset password |
| `P1-04` | Auth API | `modules/identity/api/**` | Controllers, Zod DTOs, JwtGuard, RolesGuard |
| `P1-05` | WS auth guard | `src/platform/auth/ws-auth.guard.ts` | Socket handshake auth, attaches userId, rejects cleanly |

**Acceptance:** register, login, call `/me`, refresh, reuse an old refresh token and get the family revoked.

---

## P2 — Sellers and verification

> Context: `03-DATA-MODEL.md` §3, `05-API-SPEC.md` §3 and §11, `00-PRD.md` §4.1

| ID | Title | Touches | Deliverables |
|---|---|---|---|
| `P2-01` | Seller schema | `prisma/schema/sellers.prisma` | Seller, SellerApplication, SellerDocument, SellerBankAccount + migration |
| `P2-02` | Private document storage | `src/platform/storage/**` | Presigned PUT for private bucket, signed GET with 60s TTL, SSE-KMS, separate bucket from public media |
| `P2-03` | Application use cases | `modules/sellers/application/**` | create/update draft, attach document, submit, withdraw |
| `P2-04` | Seller state machine | `modules/sellers/domain/**` | `DRAFT → PENDING_REVIEW → APPROVED/REJECTED → SUSPENDED`, transition guards as pure rules |
| `P2-05` | Admin review use cases | `modules/sellers/application/**` | approve (creates channel, emits `seller.approved.v1`), reject with reason, suspend, reinstate |
| `P2-06` | Seller + admin API | `modules/sellers/api/**`, `modules/admin/api/**` | Seller routes, admin review queue routes, AuditLog written on every admin mutation |

**Acceptance:** a user applies, uploads two documents, submits; an admin sees the queue, opens a signed document URL (logged), approves; a channel exists and the seller can reach seller-only routes.

---

## P3 — Catalog and channels

> Context: `03-DATA-MODEL.md` §4 and §5, `05-API-SPEC.md` §4 and §5

| ID | Title | Touches | Deliverables |
|---|---|---|---|
| `P3-01` | Catalog schema | `prisma/schema/catalog.prisma` | Category tree, Product, ProductImage + migration + category seed |
| `P3-02` | Product use cases | `modules/catalog/application/**` | CRUD, archive, image attach/detach |
| `P3-03` | **Inventory reservation** | `modules/catalog/application/reserve-stock.usecase.ts` | Atomic `UPDATE ... WHERE quantity - reserved >= qty RETURNING *`, plus release. **Read `06-REALTIME-AND-CONCURRENCY.md` §7.** |
| `P3-04` | Channels schema + use cases | `prisma/schema/channels.prisma`, `modules/channels/**` | Channel, ChannelFollow, follow/unfollow, follower count projection |
| `P3-05` | Catalog + channel API | `modules/catalog/api/**`, `modules/channels/api/**` | Controllers, DTOs, presigned image upload |

**Acceptance:** seller creates a product with images; two concurrent reservations of a quantity-1 product produce exactly one success.

---

## P4 — Streaming and rooms

> Context: `03-DATA-MODEL.md` §5, `06-REALTIME-AND-CONCURRENCY.md` §1, §3, §8, §9

| ID | Title | Touches | Deliverables |
|---|---|---|---|
| `P4-01` | Streaming schema | `prisma/schema/streaming.prisma` | StreamSession + migration |
| `P4-02` | Stream provider port + adapter | `modules/streaming/domain/ports/`, `modules/streaming/infra/` | `StreamProviderPort`: createRoom, publishToken, viewerToken, endRoom. One adapter (LiveKit or IVS). |
| `P4-03` | Session lifecycle | `modules/streaming/application/**` | create, start (guards on seller APPROVED), end, provider webhook handler, `stream.reconcile` job |
| `P4-04` | Socket gateway core | `modules/streaming/api/ws/**` | Socket.IO server, redis adapter, `room.join`/`room.leave`, `room.state` snapshot, heartbeat |
| `P4-05` | Presence | `modules/streaming/infra/presence.service.ts` | Redis sorted set, reaper job, throttled `viewers.count` broadcast |
| `P4-06` | Chat | `modules/chat/**` | Schema, send with rate limit, async persist, Redis capped recent list, moderation delete, ban check |

**Acceptance:** two clients on two different app instances join the same room; a chat message from one reaches the other; viewer count is correct; killing one instance leaves the other unaffected.

---

## P5 — Sale engine (the core)

> Context: `03-DATA-MODEL.md` §7, `06-REALTIME-AND-CONCURRENCY.md` §4 to §7, `05-API-SPEC.md` §7
>
> **Every ticket here is pure-domain-first. Write the rule and its unit test before any I/O.**

| ID | Title | Touches | Deliverables |
|---|---|---|---|
| `P5-01` | Sales schema | `prisma/schema/sales.prisma` | Sale, Bid, Offer + enums + indexes + migration |
| `P5-02` | Increment rule | `modules/sales/domain/rules/increment.rule.ts` | Price-band increment table from config, `minimumNextBid(current)`, pure, fully unit tested |
| `P5-03` | Anti-snipe rule | `modules/sales/domain/rules/anti-snipe.rule.ts` | `shouldExtend(now, endsAt, extensionCount)` computing from **now**, max-extension cap, pure, unit tested |
| `P5-04` | Auction entity | `modules/sales/domain/entities/auction.entity.ts` | State machine + `evaluateBid()` returning accept/reject/extend decision. No I/O. |
| `P5-05` | Repositories | `modules/sales/infra/repositories/**` | Prisma adapters, `lockForUpdate(saleId)`, mappers |
| `P5-06` | **place-bid use case** | `modules/sales/application/commands/place-bid.usecase.ts` | The critical path. Lock, validate, persist, extend, then reschedule + fanout **after commit**. |
| `P5-07` | Auction close | `modules/sales/application/commands/close-auction.usecase.ts`, `modules/sales/infra/jobs/**` | Idempotent close, BullMQ delayed job keyed `close:{saleId}`, reschedule on extend, 10s sweeper backup, emits `sale.resolved.v1` |
| `P5-08` | Buy now + offers | `modules/sales/application/commands/{buy-now,submit-offer,respond-to-offer}.usecase.ts` | Buy now via atomic reservation; offer submit/accept/reject/counter with expiry job |
| `P5-09` | Sales gateway + HTTP | `modules/sales/api/**` | WS handlers for `bid.place`, `buy.now`, `offer.submit`; HTTP fallbacks; all outbound events from `06-…` §2 |

**Acceptance (all must pass before P6 starts):**
- 50 simultaneous identical bids → exactly 1 accepted, 49 rejected with correct `minimumNext`
- Bid at `endsAt - 50ms` extends; bid at `endsAt + 10ms` rejected
- Extension cap enforced
- Close job running twice creates one resolution
- Redis flushed mid-auction → sweeper still closes it
- Two concurrent buy-now on stock of 1 → one order

---

## P6 — Orders and payments

> Context: `03-DATA-MODEL.md` §8 and §9, `05-API-SPEC.md` §8 and §9

| ID | Title | Touches | Deliverables |
|---|---|---|---|
| `P6-01` | Orders schema | `prisma/schema/orders.prisma` | Order, OrderEvent + migration |
| `P6-02` | Order creation | `modules/orders/events/handlers/on-sale-resolved.handler.ts` | Consume `sale.resolved.v1`, snapshot commission, compute totals, assert `total = item + shipping + tax` |
| `P6-03` | Order state machine | `modules/orders/domain/**` | `PENDING_PAYMENT → PAID → SHIPPED → DELIVERED → COMPLETED`, plus CANCELLED/REFUNDED/DISPUTED, pure guards |
| `P6-04` | Payments schema + port | `prisma/schema/payments.prisma`, `modules/payments/domain/ports/` | Payment, Refund, WebhookEvent, `PaymentProviderPort` |
| `P6-05` | Stripe adapter | `modules/payments/infra/stripe/**` | PaymentIntent create/confirm/capture, refund, saved payment methods, signature verification |
| `P6-06` | **Webhook pipeline** | `modules/payments/api/webhooks/**`, `modules/payments/infra/jobs/**` | Verify → insert `WebhookEvent` (unique `providerEventId` = dedupe) → return 200 fast → process in job. **No ledger work in the HTTP handler.** |
| `P6-07` | Payment use cases | `modules/payments/application/**` | pay order (Idempotency-Key required), retry, refund, emits `order.paid.v1` |
| `P6-08` | Shipping and delivery | `modules/orders/application/**` | ship with tracking, buyer confirm, auto-confirm job after N days, emits `order.delivered.v1` |

**Acceptance:** a resolved sale produces an order; paying charges once even if the endpoint is called 5 times with the same key; the same webhook delivered twice has one effect; shipping and delivery move state correctly.

---

## P7 — Ledger and payouts

> Context: `03-DATA-MODEL.md` §10 and §11, `01-ARCHITECTURE.md` §5
>
> **Strictest module. Nothing here ships without tests proving the invariants.**

| ID | Title | Touches | Deliverables |
|---|---|---|---|
| `P7-01` | Ledger schema | `prisma/schema/ledger.prisma` | LedgerAccount, LedgerTransaction, LedgerEntry, SellerBalance + migration + account seed |
| `P7-02` | Ledger domain | `modules/ledger/domain/**` | Transaction builder that **refuses to construct** an unbalanced transaction. Pure, heavily unit tested. |
| `P7-03` | Ledger service | `modules/ledger/application/ledger.service.ts` | `post(transaction)` idempotent by key, append only, single DB transaction. **This is the only write path into the ledger.** |
| `P7-04` | Order-paid posting | `modules/ledger/events/handlers/on-order-paid.handler.ts` | The 5-entry transaction from `03-DATA-MODEL.md` §10 |
| `P7-05` | Release on delivery | `modules/ledger/events/handlers/on-order-delivered.handler.ts` | Move pending → available, respect `Seller.payoutHoldDays` |
| `P7-06` | Balance projection | `modules/ledger/application/**` | `SellerBalance` maintained from entries + a `rebuildBalance(sellerId)` command that recomputes from scratch |
| `P7-07` | Payout engine | `prisma/schema/payouts.prisma`, `modules/payouts/**` | PayoutRun, batch by seller, `PayoutItem.orderId` unique, idempotency key per payout, transfer adapter, statement generation |
| `P7-08` | Reconciliation | `modules/ledger/infra/jobs/reconcile.processor.ts` | Nightly: every transaction balances; projections match entries; ledger cash matches processor totals. Critical alert on any mismatch. |

**Acceptance:**
- Constructing an unbalanced transaction throws
- `order.paid` replayed 10 times posts once
- `rebuildBalance` on 10,000 entries matches the projection exactly
- A payout run executed twice transfers once
- An order can never appear in two `PayoutItem` rows
- Reconciliation detects a deliberately injected mismatch

---

## P8 — Notifications and admin

| ID | Title | Touches | Deliverables |
|---|---|---|---|
| `P8-01` | Notification core | `modules/notifications/**` | Template registry, channel ports (push, email), delivery record |
| `P8-02` | Push adapter | `modules/notifications/infra/**` | Expo push or FCM, token invalidation handling |
| `P8-03` | Email adapter | `modules/notifications/infra/**` | Transactional email, verification, receipts, payout statements |
| `P8-04` | Event subscriptions | `modules/notifications/events/**` | channel went live, outbid, won, order shipped, payout sent, application decided |
| `P8-05` | Admin read models | `modules/admin/application/**` | Queues and dashboards: pending applications, disputed orders, failed payouts, held payouts |
| `P8-06` | Admin actions API | `modules/admin/api/**` | All routes in `05-API-SPEC.md` §11, every mutation audited |

---

## P9 — Hardening

| ID | Title | Deliverables |
|---|---|---|
| `P9-01` | Rate limiting everywhere | Redis token bucket applied per `05-API-SPEC.md` §13, on HTTP and WS |
| `P9-02` | Idempotency middleware | `Idempotency-Key` guard + `IdempotencyRecord` store, applied to all money endpoints |
| `P9-03` | Observability | Pino with request/trace/room ids, OTel tracing across WS and jobs, metrics per `02-TRD.md` §7, Sentry |
| `P9-04` | Alerting | Queue depth, job failure rate, reconciliation mismatch, webhook lag, bid latency p95 |
| `P9-05` | Load tests | k6 scripts for all five scenarios in `06-…` §12, run against staging |
| `P9-06` | Runbooks | `docs/runbooks/`: stuck auction, failed payout, reconciliation mismatch, provider outage, rollback |

---

## Critical path

```
P0 ─▶ P1 ─▶ P2 ─┬─▶ P4 ─▶ P5 ─▶ P6 ─▶ P7 ─▶ launch
                └─▶ P3 ─┘
                            P8 and P9 run in parallel from P6 onward
```

**P5 and P7 are the two phases that decide whether this product works.** Everything else is ordinary CRUD. Budget accordingly and do not let them be rushed.

---

## Parallelisation

If a second developer joins:

| Track | Phases |
|---|---|
| A | P0 → P1 → P2 → P4 → P5 |
| B | P3 → P6 → P7 |
| Either | P8, P9 |

The contract between tracks is the domain event names in `01-ARCHITECTURE.md` §2. Agree those first and the tracks never block each other.

---

## Definition of done (every ticket)

- [ ] Types compile with `strict: true`, no `any`
- [ ] Domain logic is pure and unit tested
- [ ] Zod validation at every boundary
- [ ] No cross-module import that bypasses a service facade
- [ ] Money is `BigInt` minor units
- [ ] Mutating money endpoints require `Idempotency-Key`
- [ ] Jobs are idempotent
- [ ] Errors are typed domain errors with codes from the registry
- [ ] Logs carry request id and relevant entity ids
- [ ] Migration included and reversible
