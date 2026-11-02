# engineering-backlog-progress.md: Plain engineering hardening backlog (local-only, never committed)

Started 19 Oct 2026. **Decision, 19 Oct 2026**: the founder has now been handed TestFlight access.
When asked what's left, the user picked this backlog to work FIRST, ahead of the still-open
"scheduled/upcoming stream display" item (`founder_requests.md` §7 — still the oldest open backlog
item, still genuinely not built, still waiting on a founder decision about what an upcoming stream
should look like given AI thumbnails are explicitly ruled out. Not touched by this file).

**This file tracks real, unglamorous platform hardening** — things flagged as gaps since the
original 65-ticket build and never picked up because streaming/storage/the founder's live-feature
asks kept taking priority. See `prompt.md` §5a for the original list this was pulled from, and §16
for why trackers get cross-checked against `git log`, not trusted blindly.

**Workflow for this arc (confirmed with the user, stricter than previous arcs):**

- Work in PHASES, each broken into SUB-PHASES. Stop and report after every sub-phase, update this
  file, wait for "continue" before starting the next one.
- **The user runs every GitHub command and every EC2 command, always.** The agent never runs
  `git add`/`commit`/`push`/`deploy`, and never SSHes into EC2 itself — it hands over the exact
  commands and waits.
- **Typecheck runs happen in the foreground, visibly in the chat** — not silently, not in a
  background task. Show the real command and its real output.
- **Every sub-phase that ships a feature gets actually exercised before it's called done** — not
  just `tsc --noEmit` clean. Hit the real route (curl / a script against the dev or EC2 API), or
  drive the real screen in a browser, and show what happened. Typechecking proves the code compiles;
  it does not prove the feature works. A sub-phase isn't "done," it's "typechecked" until this step
  happens too.
- **No `Co-Authored-By: Claude` (or any AI attribution) in commit messages this project generates.**
  Standing instruction for this repo specifically — draft commit messages without it.
- Direct file edits, not snippets-only (`AGENTS.md`'s snippets-only rule stays superseded).
- Never invent a schema field, endpoint, or business number not backed by the docs or the data —
  flag a gap, don't fill it silently. Several sub-phases below have a real decision flagged already;
  don't guess past those.

---

## The one item explicitly EXCLUDED from this backlog, and why

**Real payouts (replacing `MockTransferAdapter`) is NOT a phase here.** Confirmed by reading
`09-DECISIONS.md` directly: **D-001** ("Legal cover for holding and transmitting funds: money
transmitter licensing, KYC/AML programme, 1099-K reporting, seller agreement") is marked **Open**
and the doc's own words are "**D-001 is the only item that can stop launch**... built to whatever the
legal advisers specify... if that answer changes to 'use Stripe Connect after all', P7 shrinks
considerably and the ledger becomes a mirror rather than the source of truth." **D-002** (company
accounts — bank, Stripe, AWS, domain, in the business's own name) is also Open.

This is a legal/business decision, not an engineering ticket. `mock-transfer.adapter.ts`'s own
comment already says as much: "**Do not treat this as done or let a real payout run reach it in
production**... blocked on D-001/D-002... replace once a legal/infra decision actually names a
rail." **Do not attempt to build real payouts in this arc.** If the founder says D-001/D-002 are
resolved, that's a new, separate, much bigger arc (likely Stripe Connect onboarding, KYC flows, a
real ledger-to-processor reconciliation rail) — flag it back to the user rather than quietly
starting it inside a "hardening" phase.

---

## Phase table

| Phase | What                                                                                        | Why this order                                                                                                                               | Status                                                                                       |
| ----- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1     | Seller/admin order cancel (`PENDING_PAYMENT` or `PAID`)                                     | Already spec'd (`05-API-SPEC.md` §8), narrowest scope, zero decisions needed                                                                 | DONE — committed (b15c2b2, pushed); on-server deploy per founder, unverified                 |
| 2     | Real seller analytics (replace the mock dashboard numbers)                                  | No decisions needed, clear backend+frontend shape, reuses the admin analytics pattern                                                        | DONE — 2a–2d + 2e closed: end-to-end verified live, gates green, commit + deploy handed over |
| 3     | Ledger hardening: refund/dispute entries, the reconciliation's 3rd check, job retry/backoff | One founder decision needed (dispute policy) before 3b; 3c/3d don't need it                                                                  | Not started                                                                                  |
| 4     | CI/CD + tested backup/restore                                                               | Infra-only, no product decisions, but worth sequencing after the ledger work since it touches jobs too                                       | Not started                                                                                  |
| 5     | Push notifications (real sends, not just history)                                           | Needs one dependency-approval decision (`expo-notifications`, outside `02-TRD.md` §1) before building                                        | Not started                                                                                  |
| 6     | Card entry on phones                                                                        | Needs one dependency-approval decision (`@stripe/stripe-react-native`) AND a real EAS native build to test — biggest lift, sequenced last    | Not started                                                                                  |
| —     | Real payouts                                                                                | **Excluded** — blocked on legal decision D-001/D-002, not an engineering task. Don't start without being explicitly told those are resolved. | N/A                                                                                          |

Reorder/combine if a better split becomes obvious once inside the code — this is a starting point,
not a constraint, same as every other tracker in this repo.

---

## Decisions needed (flag here, don't guess silently)

- **Phase 3's dispute/refund policy**: when a buyer disputes or gets refunded on an order whose
  seller has already been paid out (or has a pending payout), what happens to the seller's money?
  Clawback the pending balance, hold future payouts, or absorb it as a platform loss? No answer
  exists anywhere in the docs — ask before building 3b's ledger entries, the entries themselves
  depend on the answer (which accounts get debited/credited).
- **Phase 5's dependency approval**: adding `expo-notifications` (outside `02-TRD.md` §1) needs
  explicit sign-off before `npm install` — flag it, don't add it silently, per `AGENTS.md` §8.
- **Phase 6's dependency approval**: adding `@stripe/stripe-react-native` (also outside `02-TRD.md`
  §1) needs the same sign-off, plus it needs a real EAS dev/production build to test at all — it
  will not work inside Expo Go. Flag the build requirement explicitly when this phase starts.

---

## Phase write-ups (fill in as each phase/sub-phase lands)

### Phase 1 — Seller/admin order cancel

**Ground truth, confirmed by reading the code, not assumed:**

- `05-API-SPEC.md` §8 documents `POST /orders/:id/cancel` as **seller/admin**, "Cancel before
  shipment" (line 245).
- Only a narrower **buyer** version exists today (app integration Phase 6, `PENDING_PAYMENT` only,
  same route) — confirmed in `prompt.md` §6a's Phase 6 carry-over note. The documented seller/admin
  version (which the spec implies should also cover `PAID`, i.e. after payment but before shipment)
  has never been built.
- Whatever cancels a `PAID` order needs to trigger the right money-back path (a Stripe refund, a
  ledger entry) — check how the existing Stripe refund webhook handler
  (`payment-provider.stripe.adapter.ts` / the webhook controller) already models a refund before
  inventing a second path; a seller/admin-initiated cancel of a paid order is functionally "we're
  refunding this," not a new money concept.

**Sub-phase 1a — seller/admin cancel for `PENDING_PAYMENT` (auth plumbing, no money involved) — DONE, verified live against dev, 19 Oct 2026.**

What landed:

- New `CancelOrderAsSellerOrAdminUseCase` (`src/modules/orders/application/commands/cancel-order-as-seller-or-admin.usecase.ts`) — a separate use case from the existing buyer-only `CancelOrderUseCase`, not a modification of it. Takes an `actor` union (`{role:'SELLER', userId}` or `{role:'ADMIN'}`). Seller branch resolves the caller's own `Seller.id` via `SellersService.getMySeller` and compares to `order.sellerId`, masking a mismatch as 404 — same precedent as `ShipOrderUseCase`. Admin branch has no ownership check at all. Deliberately scoped to `PENDING_PAYMENT` only for now (`SELLER_ADMIN_CANCELLABLE_FROM = ['PENDING_PAYMENT']`) — see decision note below on why `PAID` isn't wired yet.
- `OrdersService.cancelAsSellerOrAdmin()` facade method, wired into `orders.module.ts`.
- `orders.controller.ts`'s existing `POST /orders/:id/cancel` handler now branches on `user.role` (`ADMIN`/`SELLER`/`BUYER`) to the right use case — one route serving all three callers, matching `05-API-SPEC.md` §8's documented `seller/admin` auth plus the pre-existing buyer carve-out. No new route, no DTO change.
- `OrderRepositoryPort.markCancelled` needed zero changes — it already took an arbitrary `allowedFrom` list.

**Real bug caught by actually exercising this (not just typechecking):** the seller branch 500'd on first real HTTP test. Root cause: `SellerPrismaRepository.findByUserId`'s mapper throws if a `Seller` row has no matching `SellerApplication` row — a real invariant in this codebase (create/update always write both together), tripped by my own test fixture seeding `Seller` without `SellerApplication`. Fixed the fixture, not the code — re-ran, all 6 scenarios below passed. Flagging because this is exactly the kind of thing `tsc --noEmit` alone would have missed.

**Verified against a real running dev API** (local Postgres+Redis via `docker compose up -d postgres redis`, migrations applied, `ts-node src/main.api.ts`, real JWTs signed with the dev `JWT_ACCESS_SECRET`, real seeded `Seller`+`SellerApplication`+`Order` rows, real `curl` calls, DB state checked after):

1. Seller cancels their own `PENDING_PAYMENT` order → `201`, `status: CANCELLED`, `order.cancelled` event appended.
2. Seller tries to cancel an order they don't own → `404 ORDER_NOT_FOUND` (masked, not 403).
3. Admin cancels any `PENDING_PAYMENT` order, including one they don't own → `201`, `CANCELLED`.
4. Buyer regression check: existing buyer-only path still works unchanged → `201`, `CANCELLED`.
5. Seller (and by the same code path, admin) tries to cancel a `PAID` order → `409 INVALID_ORDER_STATUS`, correctly rejected — confirms the `PAID` branch is genuinely not reachable yet, not just untested.
6. Buyer tries to cancel an order they don't own → `404 ORDER_NOT_FOUND` (pre-existing behavior, unchanged).

All test fixtures and the temporary API process were removed after verification; no test data left in the dev DB. `tsc --noEmit` and `eslint --max-warnings 0` both clean on every changed/added file (ran visibly, see chat).

**Why `PAID` isn't wired yet, on purpose:** cancelling a `PAID` order needs to actually give the buyer's money back (a Stripe refund) and reverse the `order.paid` ledger posting, or the order would show `CANCELLED` while the buyer stays charged — a real money bug, not a style issue. That's sub-phase 1b. Confirmed from reading the code (not guessed): `CANCEL`'s domain-rule transition (`order-status-transition.rule.ts`) already legally allows `PAID → CANCELLED` — this was already a settled, doc-backed design decision (05-API-SPEC.md §8: "Cancel before shipment"), not something sub-phase 1b needs to re-decide. Also confirmed: cancelling only ever fires before `SHIPPED`, so a `PAID` order's seller-pending ledger credit has never been released to `SELLER_AVAILABLE` (that only happens on delivery) — meaning 1b's refund/ledger-reversal case is a clean reversal of money still sitting in `SELLER_PENDING`, and does **not** touch Phase 3's harder, founder-decision-gated question (what happens when a seller has _already_ been paid out or has a pending payout at dispute/refund time). Flagging this distinction explicitly so it doesn't get conflated with Phase 3 later.

**Sub-phase 1b — PAID-order cancel: real Stripe refund + ledger reversal — DONE, verified live against dev with a real Stripe test-mode charge, 19 Oct 2026.**

What landed:

- `SELLER_ADMIN_CANCELLABLE_FROM` widened to `['PENDING_PAYMENT', 'PAID']`.
- `OrderCancelledPayload` widened (v1→v2): `cancelledByUserId`, `wasPaid`, `currency`, `itemAmount`, `commissionAmount`, `sellerNetAmount` — same "carries enough to post without a round-trip" convention as `OrderPaidPayload`. Both `CancelOrderUseCase` (buyer) and `CancelOrderAsSellerOrAdminUseCase` populate it; `wasPaid` is computed from the order's status _before_ the transition, not trusted from anywhere else. `CancelOrderAsSellerOrAdminActor`'s `ADMIN` branch now also carries `userId` (needed to attribute the refund).
- `RefundPaymentUseCase.refundForCancelledOrder()` — a new method (not a new use case) alongside the existing `execute()`, reusing the same ports. Refunds whatever's actually remaining on the payment and updates `Payment.status`, but deliberately never calls `OrdersService.markRefunded` — the order is already `CANCELLED` by the time this runs, and `REFUND`'s legal origin set doesn't include `CANCELLED` (`Order.status` and `Payment.status` are independent fields here, same precedent `execute()` itself already documents). No-ops cleanly (not an error) when there's genuinely nothing to refund.
- Two new event-bus handlers, both subscribing to `order.cancelled` and no-op'ing when `wasPaid` is false: `src/modules/payments/events/handlers/on-order-cancelled.handler.ts` (calls the refund method above) and `src/modules/ledger/events/handlers/on-order-cancelled.handler.ts` (posts a reversing ledger transaction — `CREDIT PLATFORM_CASH`, `DEBIT SELLER_PENDING`, `DEBIT PLATFORM_REVENUE`, the mirror image of what `on-order-paid.handler.ts` posts, idempotency key `order.cancelled:<orderId>`). Both subscribe via `EVENT_BUS` rather than a module import — same decoupled shape the ledger module already uses for `order.paid` — specifically to avoid creating a new `Orders↔Payments` module-import cycle (Payments already has a one-directional import of Orders; this codebase has already been bitten once by a module cycle crashing at boot, see `prompt.md` §16). `PaymentsModule` needed `EventsModule` added to its imports (it didn't have it before — nothing in that module published/subscribed to domain events until now).
- Confirmed safe to debit `SELLER_PENDING` directly without checking which account the money is actually in (unlike `releasePendingForOrder`'s own lookup): `CANCEL`'s legal origin set excludes `SHIPPED`/`DELIVERED`/`COMPLETED`, so a cancellable order's seller credit can never have been released to `SELLER_AVAILABLE` yet. This is why Phase 3's dispute-policy decision (what happens when a seller's _already_ been paid out) genuinely doesn't apply to this sub-phase — confirmed again, not just asserted.

**Real bug caught by actually exercising this (not just typechecking), unrelated to the business logic itself:** the dev API wouldn't boot after this change — `RedisService.onModuleInit` threw `"Redis is already connecting/connected"`. Root cause: a **pre-existing latent bug**, not something introduced by this sub-phase's business logic — `RedisService.onModuleInit` calls `.client.connect()` unconditionally, while its sibling `PubSubService` already carries a documented guard for this exact symptom (`src/platform/redis/pubsub.service.ts`'s own comment: hit once before, in P4-06, "once enough modules shared RedisModule concurrently for this hook to run more than once on the same instance" — a known quirk, never patched in `RedisService` itself). Adding `EventsModule` to `PaymentsModule`'s imports pushed the module graph over whatever threshold triggers it. **Fixed** by applying the identical guard (`if (this.client.status === 'wait')`) to `RedisService.onModuleInit` — `src/platform/redis/redis.service.ts`. Flagging prominently because this is exactly the class of bug `tsc --noEmit` cannot catch, and it would have blocked the API from booting at all on the next deploy.

**Verified against a real running dev API with a genuine Stripe TEST-mode charge** (not a fabricated id): created a real PaymentIntent via `pm_card_visa` (Stripe's built-in test payment method), confirmed+captured it, seeded a matching `PAID` order + `Payment(SUCCEEDED)` + the `order.paid` ledger transaction + `SellerBalance` a real `order.paid` posting would have left. Then:

1. Seller cancels their own `PAID` order → `201`, `status: CANCELLED`.
2. `Payment.status` → `REFUNDED`; a real `Refund` row with a genuine Stripe `providerRefundId`, full amount (10000, including shipping/tax — refunds the whole `Payment.amount`, independent of the ledger's narrower itemAmount-only posting), attributed to the cancelling seller's own user id.
3. Reversing ledger transaction `order.cancelled:<orderId>` posted correctly: `CREDIT PLATFORM_CASH 9000`, `DEBIT SELLER_PENDING 8100`, `DEBIT PLATFORM_REVENUE 900` — balances (9000 = 8100+900), exact mirror of the seeded `order.paid` entries.
4. `SellerBalance.pendingAmount` correctly dropped from `8100` back to `0` via the normal `applyBalanceDeltas` path (not a special case).
5. **Confirmed directly against Stripe's own API** (not just our DB): `stripe.charges.retrieve()` on the real test charge shows `refunded: true`, `amount_refunded: 10000`.
6. Re-cancelling the now-`CANCELLED` order → `409 INVALID_ORDER_STATUS`, confirming no double-refund path is reachable (both the order-status guard and `refundForCancelledOrder`'s own `Payment.status` check would have independently caught it).

All test fixtures (the real Stripe test charge stays on Stripe's test ledger, harmless), the temporary API process, and the dev DB rows were cleaned up after. `tsc --noEmit` and `eslint --max-warnings 0` both ran clean on every changed/added file (shown in chat) before any live testing started.

_Phase 1 overall: 1a done, 1b done. 1c (draft commit message, hand off exact deploy commands) next — or straight to Phase 2 if you'd rather bundle the commit later._

### Phase 2 — Real seller analytics

**Ground truth:** no seller-facing analytics endpoint exists anywhere (confirmed repeatedly across
earlier sessions — `prompt.md` §5a, §6a Phase 7's carry-over). The seller dashboard's stat
cards/weekly chart are mock, disclosed in the UI as such. The admin portal already has a working
pattern to copy: `GET /admin/analytics/*` routes use a shared raw-SQL `date_trunc` helper
(`src/modules/admin/...`) — reuse that shape for a seller-scoped equivalent rather than inventing a
new aggregation approach.

**Scope expanded 19 Oct 2026, confirmed with the user:** the mock dashboard has 4 stat cards
(Sales, Orders, Viewers, Conversion %) + a weekly chart. Sales/Orders/weekly chart are directly
computable from real `Order` data (mirrors admin's pattern exactly). Viewers/Conversion are not —
there is no viewer-count or view-tracking data anywhere in the schema, not just missing from the
dashboard. Investigated the streaming module directly: the _live_ "127 watching" mechanism (Socket.IO
room + Redis ZSET presence, throttled broadcast, `06-REALTIME-AND-CONCURRENCY.md` §8) is real and
fully built — nothing wrong there. But `StreamSession.peakViewers`/`itemsSold`/`grossAmount` are
schema columns with **zero write path anywhere in the codebase**, despite the docs asserting
`peakViewers` gets set when a stream ends. User chose: (1) viewer metric = peak concurrent (not
total unique — no infra exists for unique-viewer tracking, peak concurrent is the buildable,
industry-standard framing and what the schema already anticipated), (2) fix `itemsSold`/
`grossAmount` in the same pass since they're the identical "column exists, nothing writes it" gap.

### Sub-phase 2a — persist StreamSession.peakViewers/itemsSold/grossAmount on session end — DONE, verified live, 19 Oct 2026.

What landed:

- `PresenceService` (`src/modules/streaming/infra/presence.service.ts`): tracks a running peak per
  session in Redis (`room:{sessionId}:peakViewers`, self-expiring after 24h — no explicit cleanup
  needed, covers every path that can end a session without each one remembering to clear it),
  updated inside the same `recalculateAndThrottle` tick that already runs on every join/heartbeat/
  leave. New `getPeakViewerCount(sessionId)` read method.
- `SaleRepositoryPort.getSessionSalesStats(sessionId)` (new, `src/modules/sales/...`): `itemsSold`/
  `grossAmount` via `prisma.sale.aggregate`, scoped to `orderId IS NOT NULL` (a sale that actually
  produced a real order) rather than trusting `status = 'RESOLVED'` alone (which also covers an
  auction that resolved with no winner — no order, nothing sold). Exposed through `SalesService`
  via a new thin `GetSessionSalesStatsQuery`, matching the rest of that file's one-class-per-query
  convention. No new cross-module edge needed — `StreamingModule` already imports `SalesModule`
  one-directionally.
- `StreamSessionRepositoryPort.updateStats(id, stats)` (new): unconditional overwrite with the
  freshly-recomputed values, safe to call more than once per session (idempotent, `AGENTS.md` §4).
- New `SessionStatsFinalizer` (`src/modules/streaming/application/session-stats-finalizer.service.ts`):
  reads both sources, writes the snapshot. Deliberately swallows its own failures (logs a warning,
  doesn't throw) — ending a stream must succeed even if this best-effort analytics snapshot hits a
  transient Redis/DB blip; the session has already ended by the time this runs.
- Wired into all four paths that can end a session: `EndSessionUseCase` (seller's own `/end`),
  `KillSessionUseCase` (admin kill), `ReceiveProviderWebhookUseCase` (LiveKit webhook), and
  `StreamReconcileProcessor` (the 60s reconcile sweep) — the latter two only finalize when
  `endIfLive` actually transitioned something (non-null), not on its no-op path.

**Verified against a real running dev API, real Redis, real Postgres** (not mocked): seeded a LIVE
session + 3 sales (2 with a real `orderId` set, 1 without), drove the real `PresenceService`
directly (3 real `recordHeartbeat` calls, then 2 real `removeViewer` calls) via a genuine NestJS
application context — confirmed current count dropped 3→1 while peak correctly stayed at 3. Called
the real `StreamingService.endSession` — `StreamSession` row afterward: `peakViewers: 3` ✓,
`itemsSold: 2` ✓ (the EXPIRED/no-order sale correctly excluded), `grossAmount: 8000` ✓ (5000+3000,
the excluded sale's amount correctly left out). Separately re-verified through the actual HTTP
route (`POST /v1/streams/:id/end`, full controller stack, not just the service) on a second fresh
session — `200`, `status: ENDED`, zero new errors in the log. (One pre-existing, unrelated error
did appear in the log — `StreamReconcileProcessor`'s periodic LiveKit `roomExists()` check failing
with "invalid API key" against some other dev-leftover session; confirmed unrelated, since that
check is untouched by this work and only runs on its own 60s timer.)

`tsc --noEmit` and `eslint --max-warnings 0` both clean on every changed/added file, run before any
live testing. No Prisma schema/migration changes — all three columns already existed. Test fixtures,
the temporary API process, and the dev containers were all cleaned up after.

### Sub-phase 2b — seller-scoped orders-summary/orders-by-status endpoints — DONE, verified live, 19 Oct 2026.

What landed:

- **Relocated** `modules/admin`'s `analytics-range.util.ts` (pure, stateless, zero DI) to
  `src/shared/analytics/analytics-range.util.ts` so this sub-phase could reuse the exact same
  default-30-day-window resolution without Orders importing Admin (or vice versa) just for one
  helper. Both admin query classes that used it (`get-orders-summary.query.ts`,
  `get-sellers-summary.query.ts`) updated to the new import path, behavior unchanged — admin's
  analytics module still typechecks and (per 2b's own live test below, which exercises the same
  shared function) still resolves ranges identically.
- New seller-scoped mirror of `modules/admin`'s `AnalyticsRepositoryPort`/`AnalyticsPrismaRepository`,
  living in `src/modules/orders/` (Order is Orders' domain, not Sellers' or Admin's):
  `SellerAnalyticsRepositoryPort`/`SellerAnalyticsPrismaRepository` — `ordersSummary(sellerId, range)`
  (day-bucketed `COUNT`/`SUM("totalAmount")`, `status IN ('PAID','COMPLETED')`, same raw-SQL
  `date_trunc` shape as admin's version, `sellerId` as a proper bound `$queryRaw` parameter) and
  `ordersByStatus(sellerId)` (snapshot via `prisma.order.groupBy`, index-backed by the existing
  `@@index([sellerId, status])`).
- Two new queries resolving the caller's own `sellerId` via `SellersService.getMySeller` —
  `GetSellerOrdersSummaryQuery`/`GetSellerOrdersByStatusQuery` — returning an **empty result for a
  caller with no seller profile, not an error**, same precedent `ListSellerOrdersQuery` already set.
- Two new routes on the existing `orders.controller.ts`: `GET /seller/analytics/orders-summary`
  (optional `from`/`to`, same `AnalyticsRangeQuerySchema` shape as admin's, defaults to a 30-day
  window) and `GET /seller/analytics/orders-by-status`.

**Verified against a real running dev API**: seeded one seller with 5 orders across 3 statuses and
2 days (2 `PAID` today, 1 `COMPLETED` yesterday, 1 `PENDING_PAYMENT`, 1 `CANCELLED`), plus a 6th
order belonging to a **different** seller with a deliberately large, easy-to-spot amount (99999) to
prove seller isolation. Real `curl` results:

- `orders-summary`: two day-buckets, yesterday `{orderCount: 1, revenue: 20000}`, today
  `{orderCount: 2, revenue: 15000}` (10000+5000) — `PENDING_PAYMENT`/`CANCELLED` correctly excluded
  from revenue, and the other seller's `99999` never appears anywhere.
- `orders-by-status`: `PENDING_PAYMENT: 1, PAID: 2, COMPLETED: 1, CANCELLED: 1` — exactly this
  seller's 5 orders, the other seller's order correctly excluded.
- A buyer with no seller profile hitting either route: `200`, `{"data": []}` — not an error,
  confirming the "no profile, empty result" fallback actually works, not just compiles.

`tsc --noEmit` and `eslint --max-warnings 0` both clean on every changed/added file (including the
two admin files whose import path changed) before any live testing. No Prisma schema/migration
changes. Test fixtures, the temporary API process, and the dev containers all cleaned up after.

### Sub-phase 2c — viewers/conversion aggregation — DONE, verified live, 19 Oct 2026.

What landed:

- **Further consolidated** the shared analytics DTO: 2b had copied admin's `AnalyticsRangeQuerySchema`
  into a second, orders-module-only file (`seller-analytics-range-query.dto.ts`). Since 2c needed
  a third consumer, relocated the schema itself to `src/shared/analytics/analytics-range-query.dto.ts`
  (alongside 2b's already-relocated `analytics-range.util.ts`) and deleted both now-redundant
  per-module copies — admin's controller and orders' controller both re-pointed to the one shared
  file, zero behavior change (confirmed by the admin regression test below).
- `StreamSessionRepositoryPort.sumPeakViewersForSeller(sellerId, range)` (new): `prisma.streamSession
.aggregate` filtered through the `channel: { sellerId }` relation, no raw SQL needed — Prisma's
  relation-filter syntax handles the Channel join directly. A session that never started, or
  started outside the range, is excluded; one still LIVE just contributes whatever its peak has
  reached so far (honest-incremental, same reasoning as 2a).
- New `GetSellerViewersSummaryQuery` (streaming module) → `{ totalPeakViewers, conversionRate }`.
  **Reuses `OrdersService.getSellerOrdersSummary` from 2b for the conversion numerator** rather
  than a second, parallel order-counting query — every `Order` in this platform traces back to a
  `Sale`, and every `Sale.sessionId` is non-nullable, so "orders in range" and "stream-sourced
  orders in range" are provably the same set; reusing 2b's query means the two can never disagree
  about what counts as a settled order. `conversionRate` is a ratio-of-sums (total orders ÷ total
  peak viewers across the whole range), not an average of each stream's own ratio — avoids a
  divide-by-zero-shaped mess for any single stream with zero viewers.
- New route `GET /seller/analytics/viewers-summary`, in a **new controller** inside the streaming
  module (`SellerAnalyticsController`) rather than added to the existing `streams.controller.ts` —
  that class is prefixed `@Controller('streams')`, and this route belongs at `/seller/analytics/*`
  alongside 2b's routes, not under `/streams`. Confirmed at boot that NestJS correctly maps all
  three `/seller/analytics/*` routes across the two different controllers (orders module + streaming
  module) with no prefix collision.
- `StreamingModule` now imports `OrdersModule` directly (new edge, no cycle: confirmed no module
  importing `StreamingModule` — only `admin` and `chat`, the latter already `forwardRef`'d — sits
  anywhere in `OrdersModule`'s own import graph).

**Verified against a real running dev API**: seeded one seller with 2 `ENDED` sessions in range
(`peakViewers` 10 and 40) plus 5 settled orders, **and** a session from the same seller 60 days ago
(`peakViewers: 500`, deliberately outside the default 30-day window) **and** a different seller's
session in range with `peakViewers: 9999` (deliberately huge, to catch any cross-seller leak) —
both exclusions had to hold simultaneously for the result to come out right. Real `curl` result:
`{"totalPeakViewers": 50, "conversionRate": 10}` — exactly 10+40 (the 500 and the 9999 both
correctly excluded) and exactly 5 orders ÷ 50 viewers × 100. A buyer with no seller profile:
`200`, `{"totalPeakViewers": 0, "conversionRate": 0}`, not an error. **Regression-checked the
relocated admin DTO/util**: called both real `GET /admin/analytics/*` routes with a real admin
token against real pre-existing dev data — both still returned correct, non-empty results after
the file moves, confirming the relocation changed only import paths, not behavior. Also confirmed
at boot: no module-cycle error from the new `Streaming → Orders` edge.

`tsc --noEmit` and `eslint --max-warnings 0` both clean on every changed/added file before any live
testing. No Prisma schema/migration changes. Test fixtures, the temporary API process, and the dev
containers all cleaned up after.

**API reference for 2d (all three real now, all under `/v1`, all `JwtGuard`-only, no role
restriction — any authenticated caller works, a non-seller just gets an empty/zero result):**

- `GET /seller/analytics/orders-summary?from=&to=` → `{ data: [{ day, orderCount, revenue }] }`
  (day-bucketed, `day` is the UTC-midnight instant of each bucket since 2d's fix,
  and `revenue` serializes as a plain JSON **number** via the global BigInt polyfill — settled
  against real responses in 2d). `from`/
  `to` optional, default 30-day window. This is the weekly-chart data source — sum `orderCount`/
  `revenue` across the returned points to get the "Orders"/"Sales" stat-card totals; the backend
  deliberately does not return a separate pre-summed total (see 2b's write-up above for why).
- `GET /seller/analytics/orders-by-status` → `{ data: [{ status, count }] }` — snapshot, no range.
- `GET /seller/analytics/viewers-summary?from=&to=` → `{ data: { totalPeakViewers, conversionRate } }`
  — `conversionRate` is already a percentage (e.g. `10` means 10%), not a 0-1 fraction.

**Sub-phase 2d — dashboards wired to the real endpoints (mock deleted) — DONE, verified live
against dev with a headless-browser pass, 19 Oct 2026.**

What landed (all direct edits, files named):

- NEW `frontend/src/api/seller-analytics.ts` — typed clients for the three routes
  (`getOrdersSummary`/`getOrdersByStatus`/`getViewersSummary`), sharing `SellerAnalyticsRange`
  (`from`/`to` full ISO datetimes; the backend coerces with `z.coerce.date()`). Mirror of the
  `seller-finance.ts`/`sales.ts` wrapper conventions. `revenue: number` — see verification below.
- NEW `frontend/src/hooks/useSellerDashboard.ts` — ONE shared hook used by both dashboard files:
  fetches all three endpoints + a second, fixed last-7-days `orders-summary` call (explicit
  `from`/`to` in UTC) for the chart; zero-fills the 7 day buckets by UTC date key; exports
  `DASHBOARD_RANGE_LABELS`, `describeConversion`, `formatCount`; the alive-flag pattern guards
  unmount racers; `reload()` re-runs everything. Range chips renamed to honest windows —
  "Last 7 days"/"Last 30 days"/"All time" — because "All time" passes an explicit epoch-0 `from`
  (omitting the params would silently mean the backend's 30-day default, the opposite of "all").
- REWROTE `frontend/src/screens/seller/DashboardMobile.tsx` and `Dashboard.web.tsx` (web keeps the
  sibling file's layout convention; both are now hook-driven, error/empty states included). The
  chart is always the fixed last 7 days regardless of chip; zero-filled bars; best day highlighted
  in brand color; caption "Daily revenue · last 7 days, best day highlighted". A small "Order
  status" section was added (the one surface `orders-by-status` now has) reusing `ORDER_STATUS_LABEL`
  from `api/orders.ts` — this satisfies "wire the three endpoints" without inventing a fourth
  surface. The previous hardcoded-stat-cards bug is gone with the rewrite.
- DELETED `frontend/src/data/analytics.ts` and removed its barrel export from `data/index.ts` —
  the mock is gone, not just bypassed. `Dashboard.tsx` stays a 1-line re-export of DashboardMobile
  (Metro resolves `Dashboard.web.tsx` on web).

Also **fixed one real backend determinism bug caught by actually exercising the data (in-scope:
this is the 2b-authored file, and the frontend's whole contract depends on what `day` means):**
`SellerAnalyticsPrismaRepository.ordersSummary` used `date_trunc('day', "createdAt")` — on a
`timestamptz` column that truncates in the **query session's timezone**. On a UTC-prod server
buckets are UTC midnights and everything lines up; on this box (server session `Asia/Calcutta`)
buckets were IST midnights and every `day` label serialized like `2026-10-18T18:30:00.000Z`,
silently sliding one day off the chart's UTC day keys. Proven empirically before fixing: stored
instants were byte-correct, server-side text aggregation was correct for IST-day semantics, and a
UTC-pinned expression —
`date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`
— returns exact `T00:00:00.000Z` buckets regardless of session TimeZone. One SQL line + a comment
block; typecheck and prettier clean after.

**A second suspected bug turned out to be a fixture-time artifact (documented, satisfyingly, with
receipts):** the very first verification pass saw `viewers-summary → conversionRate: 6` instead of
the expected 8, and the 30-day orders-summary showed 3 orders/$280 instead of 4/$530. Root cause:
the seed's `at(0, 11.5)` today-order sits ~8 minutes in the future at request time (seed ran
13:30 IST; window `to = now` correctly excludes a future `createdAt`). After 17:00 IST the order
slid into the window and every number self-corrected to 4 / 53000 / 8% — verified live with an
explicit far-future `to` while `now` was still pre-17:00. The endpoint's math was right all along;
the write-up is loud about it because "the API disagrees with the fixture" burned an hour.

**Lint tier note (project-level):** the frontend has no ESLint at all (root `eslint.config.js`
ignores `frontend/` completely) — so for 2d, `npx prettier --check` is the quality gate instead,
and it ran clean on every changed file (one auto-reflow applied to the backend repo file).
Backend files still clear real ESLint.

**Verified against a real running dev API + a real headless-browser pass** (not mocked):
docker Postgres+Redis up, dev API via `npx ts-node src/main.api.ts`, fresh `tmp-2d-*` seed
fixtures (2 sellers, 1 buyer, 7 orders across sellers/statuses/days with explicit UTC instants,
4 stream sessions, real JWTs). Live curl receipts:

1. `orders-by-status` → exactly `PENDING_PAYMENT 1, PAID 3, COMPLETED 1, CANCELLED 1` (other
   seller's order excluded).
2. `orders-summary` default 30d and explicit far-future window → UTC-midnight buckets
   `(17th: 1/5000, 18th: 1/8000, 19th: up-to-2/40000)`, other seller's order never present.
3. `viewers-summary` → `{totalPeakViewers: 50}` (the 45-day-ago 500-peak session and the other
   seller's 9999-peak session both excluded) and `conversionRate` 6→8 per the resolved window.
4. Buyer-with-no-seller-profile regression on ALL THREE routes → `200` with
   `{"data": []}` / `{"data": {totalPeakViewers: 0, conversionRate: 0}}` / `{"data": []}` — the
   "no profile, nothing to show" contract holds on every surface.

Browser pass (`tmp-2d-browser` throwaway + `puppeteer-core` against the machine's real Chrome,
`EXPO_PUBLIC_API_URL=http://localhost:3000/v1`, fixture JWT injected into
`localStorage.shopaflo.tokens`, phone-width viewport → `SellHub.web` correctly renders the mobile
hub, click through Sell → "Seller dashboard"): the dashboard MOUNTED and made the real calls —
server-side spans log `OPTIONS 204 → GET 200` for all four dashboard requests from a
HeadlessChrome UA; the chart's second `orders-summary` call carries the fixed UTC
`from=2026-10-13T00:00:00.000Z&to=…` window; the page rendered the live values (Sales $280, Orders
3, Viewers 50, Conversion 6% — correct for that moment's 30-day window), the zero-filled 7-day
chart with today's best day in brand blue, both chips, and the exact "Order status" counts. The
`revenue: number | string` uncertainty in the typed client is settled from these receipts (the
global BigInt polyfill serializes plain numbers, never quoted strings) — the type is now
`revenue: number`.

Extras settled while verifying:

- **Environment finding worth knowing for every future sub-phase:** port 5432 on this machine has
  TWO listeners — docker-proxy on `[::]:5432` (an EMPTY container postgres; `migrate deploy` was
  never run inside it, it has zero app tables) and a real native Windows postgres on
  `0.0.0.0:5432` (pid `postgres.exe`). Prisma resolves `localhost` IPv4-first and has been hitting
  the NATIVE server all along — that is where the migrations history, the real dev data, and all
  of this sub-phase's curls actually lived. The earlier session's "single listener, docker-only"
  note was wrong; `docker exec ... psql` inside the container queries an empty database. Nothing
  in this sub-phase depended on the mix, but future phases must not trust container-internal
  psql for DB truth.
- Kinds of receipts kept: full-page screenshot of the rendered dashboard at
  `%TEMP%\opencode\2d-dashboard.png` (kept until 2e, auto-temp path otherwise).

Cleanup: fixture users/orders/sales/sessions/channels deleted by `tmp-2d-clean.ts` with a
re-count proof (orders 0, users 0, sales 0); both `node` dev processes killed; `docker compose
down` for postgres+redis; ALL `tmp-2d-*` files and the browser dir deleted, fixture JWTs deleted.

Frontend typecheck `npx tsc --noEmit` (and the re-run after prettier's reflow) clean; backend
typecheck clean after the SQL fix. No schema/migration changes on this sub-phase.

**Follow-up notes this sub-phase surfaces (NOT acted on, per one-line-note scope discipline):**

- `modules/admin`'s `AnalyticsPrismaRepository` shares the SAME session-tz `date_trunc` shape the
  seller repo had — left untouched (committed code outside this sub-phase's touches). If/when
  production ever runs with a non-UTC server session zone, admin's day buckets would slide the
  same way; pinning it is a one-liner if desired.
- No `.spec.ts` exists for any raw-SQL aggregation in this repo (spec convention today is
  domain-only rules/entities/mappers, no DB-backed harness) — the UTC pin above therefore has a
  live-DB behavioral receipt instead of a unit test, and a harness decision belongs to a future
  testing-hardening row rather than being invented here.

### Sub-phase 2e — end-to-end verification (2a→2d as one flow), commit message + deploy handover — DONE, 19 Oct 2026

**The one flow no sub-phase had exercised as a chain:** live stream with real Redis presence →
seller ends it through the real HTTP route → the 2a finalizer writes the snapshot → 2b/2c
aggregations read it → the 2d dashboard renders it. Fixture (throwaway `tmp-2e-*` scripts, all
deleted after with recount proof): approved seller + buyer, an ENDED session 3 days ago with
`peakViewers 7` already snapshotted, a LIVE session holding 2 real sales→orders (`PAID 5000`,
`COMPLETED 3000`) plus 1 `AUCTION` sale `EXPIRED` with **no order** (the finalizer's exclusion
path, exercised through the real route this time).

Receipt chain, in order:

1. **Real presence peaks** — NestJS application-context `PresenceService.recordHeartbeat` ×3
   distinct viewers against the LIVE session → Redis `{viewerCount: 3, peakViewers: 3}` (the
   same 2a verification pattern; the 3 only live in Redis until the end request).
2. **Pre-end** `GET /seller/analytics/viewers-summary` → `{"totalPeakViewers":7,
"conversionRate":28.5714…}` — the LIVE session contributes its DB-peak of 0 (Redis's 3 is not
   snapshot yet) and the already-real 2 orders make 2/7 = 28.57%.
3. **End via the real route** `POST /v1/streams/:id/end` (seller JWT) → `200 {"status":"ENDED"}`.
4. **DB receipt** (printed by the cleanup script before deleting): the final row — the
   finalizer wrote `{"status":"ENDED","peakViewers":3,"itemsSold":2,"grossAmount":8000}` —
   real Redis peak persisted, the EXPIRED no-order sale excluded, gross = 5000+3000.
5. **Post-end** viewers-summary → `{"totalPeakViewers":10,"conversionRate":20}` (7+3, 2/10).
6. orders-summary (default 30d) → one bucket `{"day":"2026-10-19T00:00:00.000Z","orderCount":2,
"revenue":8000}` — exact UTC-midnight key (the 2b tz pin holding under the session's
   `Asia/Calcutta` zone), `revenue` as a plain number. Same result re-queried with the UI's exact
   fixed-7-day shape (`from=2026-10-13T00:00:00.000Z`).
7. orders-by-status → `[{"PAID":1},{"COMPLETED":1}]`.
8. Buyer-token regressions 3/3 — orders-summary `{"data":[]}`, viewers-summary
   `{"totalPeakViewers":0,"conversionRate":0}`, orders-by-status `{"data":[]}`.

**Browser end-to-end pass: PASS.** Phone-width headless real Chrome, seller JWT injected into
`localStorage.shopaflo.tokens`, flow Sell tab → "Seller dashboard" → all 8 assertions true:
`$80` Sales, Orders `2`, Viewers `10`, Conversion `20%`, chart caption
"Daily revenue · last 7 days, best day highlighted", Order-status rows `Paid` + `Completed`, and
all three honest window chips (`Last 7 days` / `Last 30 days` / `All time`). Screenshot receipt:
`%TEMP%\opencode\2e-dashboard.png` (may be deleted once reviewed). The API's OTel log
independently corroborates the UI-driven requests: the dashboard's dual `orders-summary` calls
(the 30-day chip window for cards AND the fixed `from=2026-10-13` window for the chart) plus
`viewers-summary`, `orders-by-status`, `seller/application`, `seller/balance` — every one 200.

**One environment finding new this sub-phase (matters for every future web dev session):**
`frontend/.env` sets `EXPO_PUBLIC_API_URL=https://api.swishfy.com/v1` (the PROD API) and Expo
inlines it into any Metro bundle — so a plain `npx expo start --web` boots the app against
**production** with local dev tokens, and the auth boot probe 401s → the client's refresh
attempt fails → `tokenStore.clear()` → bounces to Sign In. Confirmed not a token/socket bug:
`GET /v1/me` with the same JWT is 200 direct. Dev session fix: start Metro with
`EXPO_PUBLIC_API_URL=http://localhost:3000/v1` (and `EXPO_PUBLIC_REALTIME_URL=http://localhost:3000`)
in the shell env — shell env overrides `frontend/.env` for the Expo CLI. **Deploy is unaffected**
and wanting prod URLs from that file is exactly right for the prod web image.

**Final gates, all green (re-ran as one set):** backend `tsc --noEmit` clean; frontend
`tsc --noEmit` clean; backend `eslint --max-warnings 0` over `orders`/`sales`/`streaming`/
`admin`/`shared/analytics` clean; prettier clean on every changed file — 14 backend files had
picked up cross-sub-phase formatting drift (later edits on files formatted in earlier
sub-phases), fixed with a mechanical `prettier --write` on exactly those 14 and then re-proved
`tsc` + `eslint` clean; no behavior change implied.

**Cleanup proof:** API + Metro processes killed by port; `docker compose down` (0 containers);
fixture recounts 0 (users/orders/sales/sessions); every `tmp-2e-*` file and both fixture JWTs
deleted (counts 0). Nothing but the screenshot receipt remains.

**Handover (below, in chat):** the full Phase 2 commit message (no AI attribution) and the
exact deploy steps for the user to run — `git add/commit/push`, then SSH: `git pull` in
`~/swish`, `docker compose -f docker-compose.prod.yml build`, `up -d`. **No migration is
needed**: `prisma/schema/**` is untouched by Phase 2 (the finalizer persists into
already-existing `StreamSession` columns) and no new env vars are required. The deploy pushes
Phase 2 on top of Phase 1's already-pushed commit (b15c2b2) — if the EC2 server was last
deployed before b15c2b2, this same deploy carries Phase 1's code out as well.

### Phase 3 — Ledger hardening

**Ground truth, confirmed by reading `ledger.service.ts` directly:**

- `getReconciliationReport()`'s three checks: (1) every transaction balances — implemented; (2)
  `SellerBalance` projections match recomputed entries — implemented; (3) ledger cash vs. real
  processor totals — **explicitly `NOT_IMPLEMENTED`**, with the method's own doc comment explaining
  why: no `PaymentProviderPort` method exists to fetch a real Stripe balance/total to compare
  against. Building this needs one new port method (a real Stripe Balance/Balance-Transactions API
  call, test-mode keys already in place) wired into the existing report shape.
- Only `order.paid` is ever ledgered. Refunds and disputes (`charge.dispute.created`,
  `charge.dispute.closed`) are **not** — confirmed since the original build, re-confirmed every
  session since. This is the one sub-phase that needs the dispute-policy decision above before any
  entries get written.
- No BullMQ job anywhere has retry/backoff configured (`src/platform/queue` — confirmed no
  `attempts`/`backoff` options set anywhere). Every job is already required to be idempotent
  (`AGENTS.md` §4), so adding retry/backoff is safe to do without a policy decision — pure
  hardening.

_Not started._

### Phase 4 — CI/CD + backup/restore

**Ground truth:** `prompt.md` §5a confirms "No CI/CD, no tested backup/restore" as a standing gap
since the original build. The backend runs on a single EC2 instance with Docker Compose
(`deploy_progress.md`) — Postgres is a container, not a managed RDS instance, so "backup" means a
real `pg_dump`-to-somewhere-durable (S3 is already in the stack for media, reuse it) on a schedule,
with an actual tested restore, not just a cron job nobody's verified. CI means a GitHub Actions
workflow running `tsc --noEmit` + lint + the existing unit test suite on every push/PR to `main` —
nothing exotic, the repo doesn't have one at all today.

_Not started._

### Phase 5 — Push notifications

**Ground truth:** the backend side already exists — `POST /me/devices` / `DELETE /me/devices/:id`
(identity module), and `GET`/`PATCH /me/preferences` for the four notification categories. What's
missing: (1) the app never actually registers an Expo push token (needs `expo-notifications`,
flagged as outside `02-TRD.md` §1 since Phase 2 of the original integration work, never approved);
(2) the notification senders (`ConsoleEmailNotifier` and whatever else exists) don't honor the saved
category preferences at all — Phase 6 of the original integration work added reading notification
_history_, never suppressing by category; (3) there is no actual push-sending adapter — only email/
console exists.

_Not started._

### Phase 6 — Card entry on phones

**Ground truth:** confirmed repeatedly since app integration Phase 4 — card entry only works on web
today (Stripe's own hosted form). Phones need `@stripe/stripe-react-native`, a native module,
outside `02-TRD.md` §1, never approved. Critically: **this cannot be tested in Expo Go** — it needs
a real EAS development or production build on an actual device. Sequenced last because it's the
only phase whose testing step itself needs infrastructure (a build pipeline) beyond what every other
phase needs (dev/EC2 + a browser).

_Not started._
