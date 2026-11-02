# admin_progress.md: Admin portal tracker (ShopaFlo)

Tracks the admin web portal build (backend unblock slice + a new standalone `admin-portal/`
frontend). Scope: platform-staff-only tooling. Does **not** cover the seller portal ("YouTube
studio" concept the founder described) — that's a future phase, conceptually noted here but not
built. See `prompt.md` §7 for the full founder conversation this plan is built from, and the full
accepted plan this file tracks against (also inlined in `prompt.md` §7, since the ephemeral
`~/.claude/plans/*.md` file it was first written to is session-local and won't be readable by a
future session).

**Current status: all 6 phases (0-5) done and verified live. The accepted admin-portal plan is
complete.** This file was created at the same time as the plan was accepted, specifically so a
fresh session has an immediate, accurate starting point — see `prompt.md` §7's "Starting point for
the next session" for what's left (flagged gaps and open decisions, not new phases).

**Added after the plan, 13 Oct 2026, as part of app-integration Phase 8** (not one of the 6 phases
above — see `integration_progress.md`'s Phase 8 write-up for the full detail): three new sidebar
pages, `Reviews` (status filter, hide/unhide with a reason), `Reports` (a generic moderation queue
for flagged reviews/messages, with a target preview and resolve/dismiss), and `Help content`
(create/publish/unpublish/delete the app's FAQ articles). Verified live in the real browser.

## Decisions needed — now mostly closed

- [x] **Architecture**: standalone React + Vite web app (`admin-portal/`, sibling to `frontend/`,
      not a workspace member of anything — no monorepo tooling exists in this repo). **Decided by the
      user, not assumed** — the alternative (a sibling Expo/RN-web project reusing `components/ui`)
      was explicitly rejected in favor of the mainstream web ecosystem's table/filter/chart tooling,
      since the existing app's nav/components are phone-shaped and would fight a desktop admin UI the
      whole way through.
- [x] **Analytics v1 scope**: real backend aggregation (new `groupBy`/raw-SQL-backed endpoints),
      not frontend-computed tiles over flat lists. **Decided by the user** — overrides the planning
      agent's own "don't overthink it" recommendation of tiles-only; Phase 5 below is scoped
      accordingly as real new backend work, not a thin wrapper.
- [x] **Admin auth**: reuse the existing `/auth/login` + JWT `role` claim system as-is. No new
      backend auth work. Low-stakes default, not separately contested.
- [x] **Admin bootstrap mechanism**: a one-off CLI script (`scripts/admin/promote-admin.ts`,
      `pnpm admin:promote -- <email>`), not an HTTP endpoint — avoids a chicken-and-egg authorization
      problem for "who can promote the first admin." Low-stakes default.
- [ ] **Promoting admins after the first**: stay script-only indefinitely, or add an authenticated
      `POST /admin/admins` route later? Not decided — not needed for Phase 0, revisit if admin-count
      churn becomes frequent.
- [ ] **Payout unhold**: no unhold route exists in the backend today (confirmed — holds are
      one-way). Phase 3 shipped with this surfaced plainly in the UI (built and verified live — see
      Phase 3 below) rather than fixed. Build a `POST /admin/payouts/:id/release` route later if the
      founder wants holds reversible.
- [x] **Analytics time granularity**: resolved for v1 — `day`-only, enforced at the DTO level
      (`granularity` accepts only the literal `'day'`, anything else 400s). Whether `week`/`month` is
      ever needed stays open; revisit once the dashboard is in front of the founder.
- [ ] **Revenue definition**: the analytics dashboard's revenue figure counts `PAID`/`COMPLETED`
      orders only, per the plan's literal text — found live that this excludes `SHIPPED`/`DELIVERED`
      orders, which already collected payment. Likely undercounts real revenue. Flagged in the
      dashboard's own UI; needs a founder call before anyone relies on this number, not a unilateral
      widen.

## Architecture (reference — full detail in `prompt.md` §7)

New folder `admin-portal/` at repo root. React + TypeScript + Vite, `react-router`,
`@tanstack/react-table` for data grids, `recharts` for Phase 5 charts. Theme tokens
(`colors`/`spacing`/`radii`/`typography`/`shadows`) ported (copied, not shared) from
`frontend/src/theme/*.ts` — confirmed plain TS, zero RN imports, safe to copy verbatim. API client
mirrors `frontend/src/api/client.ts`'s exact envelope/refresh/idempotency-key contract (already
read in full — no need to re-derive it from scratch next session).

## Phase 0 — Bootstrap, scaffold, auth (DONE, verified live)

**Backend**: `scripts/admin/promote-admin.ts` (standalone `PrismaClient` script, `import
'dotenv/config'` so it loads `.env` regardless of how it's invoked — `prisma/seed.ts` doesn't do
this and relies on the caller having sourced `.env` into the shell already, which would've been an
easy footgun to copy). Root `package.json` script `admin:promote`. No new HTTP routes — confirmed
`POST /auth/login` already returns `role` in both the JWT and the response body
(`login.usecase.ts`), zero backend auth changes needed.

**Frontend**: `admin-portal/` scaffold — Vite + React + TS, `react-router-dom` v6, theme tokens
hand-ported from `frontend/src/theme/*.ts` (colors/spacing/radii verbatim; `typography`'s
`fontFamilies` adapted to a web Google-Fonts stack instead of RN's per-weight font names;
`shadows.card` converted from an RN shadow object to a single CSS `box-shadow` string — same visual
values, different shape, noted inline in each file). API client
(`admin-portal/src/lib/api-client.ts`) mirrors `frontend/src/api/client.ts`'s envelope/refresh/
single-flight contract exactly, with two intentional differences: tokens persist in
`localStorage` (not injectable `TokenStore` indirection — single web profile, no per-device secure
storage question), and `Idempotency-Key` generation is centralized behind a `idempotent: true`
request option (`crypto.randomUUID()` inside the client) rather than left to each call site, per
the plan's "never missed" requirement — Phase 2/3's refund and payout-run-trigger calls will use
this. Login page, `AuthContext` (localStorage-backed session, rejects a non-ADMIN login client-side
with a clear message and does not persist its tokens), `ProtectedRoute`, `AppShell` (sidebar:
Applications / Orders / Payouts / Streams & Chat / Audit Log / Analytics), one placeholder page per
section naming which phase builds it.

**Verified live, not just typechecked** (Claude-in-Chrome wasn't connected this session; fell back
to headless Chrome over raw CDP, same pattern `prompt.md` §10 already documents):

- `npx tsc -b` clean (had to add `"composite": true` to `tsconfig.node.json` — a referenced
  project needs it, otherwise `tsc -b` refuses to build it).
- `promote-admin.ts` run for real against the live dev DB: promoted a registered test user
  (`admin-bootstrap-test@example.com`) from `BUYER` to `ADMIN`.
- Real login via curl: returns `role: "ADMIN"` in both the JWT and body.
- Server-side enforcement confirmed independent of the frontend: a non-admin token gets `403` on
  `GET /admin/audit-log`; the promoted admin token gets `200`.
- Frontend, driven in a real headless browser against the real running API: a non-admin login
  (`plain-buyer-test@example.com`) shows "This account does not have admin access." and stays on
  `/login`, tokens never persisted; the admin login redirects to `/applications`, sidebar renders
  all 6 sections, placeholder page renders, sign-out visible. Screenshot taken, matches the app's
  blue-brand/spacing look.

**Two test accounts now exist for real in the dev database** (not cleaned up — they're useful,
not throwaway): `admin-bootstrap-test@example.com` / `TestPassword123!` (role `ADMIN` — usable
directly to log into the admin portal going forward, no need to re-run the promote script) and
`plain-buyer-test@example.com` / `TestPassword123!` (role `BUYER`, for re-testing the
non-admin-rejection path later).

**Found, not part of this plan, flagged rather than silently worked around**: a native Windows
PostgreSQL 17 service (`postgresql-x64-17`, confirmed via `Get-Service`) is running on this machine
and is the one actually answering `localhost:5432` — not the project's `docker compose` Postgres
container. `docker exec` into `live-auction-backend-postgres-1` shows an empty `live_auction`
database (fresh container, no tables), while the API process (connecting to the same
`DATABASE_URL=localhost:5432` from `.env`) successfully registers/logs in users against a database
that already has the full 16-migration schema and prior session data — i.e., the real backend
right now is running against the **native** Postgres, not the Docker one, despite `docker compose
up -d postgres redis` reporting success with no port-conflict error. Functionally harmless today
(the native instance has the right schema and the app works), but it means `prompt.md` §3's "bring
the backend up" instructions don't actually guarantee which Postgres gets used, and the Docker
container's data is currently just sitting empty and unused. Not touched or fixed — §3 explicitly
says this native service is unrelated to the project and not to be touched; flagging for the
founder/user to decide (stop the native service, or repoint Docker's compose port, or just
accept native Postgres as the de facto dev DB and stop running the container at all).

**Demo target** (met): bootstrap one admin via the script, log in, see the shell — confirmed. A
non-admin login is rejected client-side and every `/admin/*` call 403s server-side regardless —
confirmed both ways, independently.

## Phase 1 — Seller applications review queue (DONE, verified live)

No new backend routes — confirmed everything needed already existed and was routed in
`admin.controller.ts`: list (+`?decision=`), detail, document URL, approve, reject, commission
override, suspend, reinstate.

**Frontend**: `admin-portal/src/api/applications.ts` (typed wrappers, response shapes hand-mirrored
from `seller-application-summary.entity.ts`/`seller.entity.ts`/`seller-document.entity.ts` — kept
in step manually, same discipline as the theme files). `ApplicationsPage.tsx` — decision-filter
tabs (Pending/Approved/Rejected/All), cursor-paginated table ("Load more", 20/page), row click to
detail. `ApplicationDetailPage.tsx` — form data, document list with a "View" button (fetches a
fresh 60s signed URL per click, opens in a new tab), and status-gated actions matching
`seller-status-transition.rule.ts` exactly: Approve/Reject only shown at `PENDING_REVIEW`, Suspend
only at `APPROVED`, Reinstate only at `SUSPENDED` — the rule's transition table, not a guess, drove
which buttons appear where. A new shared `StatusBadge` component (color-by-status pill, meant to
be reused in Phases 2-4 too, not single-use).

**A real gap found and flagged, not invented around**: neither `GET /admin/seller-applications/:id`
nor any other admin route returns a seller's _current_ `commissionBps` — confirmed against
`05-API-SPEC.md` §11's own route table, not just the code. There's no documented
`GET /admin/sellers/:id` either. The commission-override UI says so explicitly inline rather than
silently showing a blank or a fabricated default — see the detail page's "Commission override"
section.

**Verified live** (headless Chrome over CDP again, Claude-in-Chrome still not connected):
registered two real test users, submitted real applications through the actual self-service seller
routes (not fixtures), then drove the whole review queue through the real UI against the real
running API: Pending tab showed both; approved one, rejected the other with a reason (reason
appears on the detail page afterward); switched to an existing fixture seller already `APPROVED`,
set commission to 1250 bps, suspended it (flag text about streams/payouts confirmed visible),
reinstated it. Every action's success banner and status badge updated correctly in the live DOM,
and **`GET /admin/audit-log` shows all five actions** (`seller.approved`, `seller.rejected`,
`seller.commission_updated`, `seller.suspended`, `seller.reinstated`) with correct `before`/`after`
state — the phase's demo target, confirmed exactly as written. `npx tsc -b` clean throughout.

**Not exercised**: the document "View" link — none of the test applications had uploaded
documents, so `GET /admin/documents/:id/url` was never actually hit through the UI this session.
The code path is a direct copy of the same `apiClient.request` + `window.open` pattern used
everywhere else and the route itself was already confirmed working in Phase 0's admin-controller
read-through, but flagging this honestly rather than claiming it as live-verified when it wasn't.

**Demo target** (met): approve/reject a real pending application, override commission, suspend and
reinstate a seller — each visible immediately in the audit log. All confirmed.

## Phase 2 — Orders management (DONE, verified live)

**Backend**: new route `GET /admin/orders/:id` in `admin.controller.ts`, a one-line
`AdminService.getOrder()` wrapper (`admin.service.ts`) around the already-existing
`OrdersService.getOrder()` — that query returns a plain nullable (not a `Result`), so the
not-found case is wrapped into `OrderNotFoundError` inside `AdminService` to match the
controller's `toHttpException` pattern. No new domain logic, no existing route touched. Returns
the full `Order` entity unsanitized — same as the existing `GET /admin/orders` list already did
(unlike the buyer/seller-facing `OrderView`, which hides `commissionAmount`/`sellerNetAmount`/
`deliveryConfirmedBy` — admin is meant to see all of it). API restarted to pick up the new route
(`ts-node` doesn't hot-reload, per `prompt.md` §3).

**Frontend**: `admin-portal/src/api/orders.ts` (typed wrappers, `Order`/`OrderStatus` hand-mirrored
from `order.entity.ts`). `admin-portal/src/lib/money.ts` — `formatMoney`/`dollarsToMinorUnits`,
since `AGENTS.md` §4 money is integer minor units everywhere and the admin types a dollar amount
for refunds. `OrdersPage.tsx` — status-tab filter (all 8 statuses + All) plus a plain visual
highlight (red left-border/tint) on any `DISPUTED` row regardless of which tab is active, so a
dispute doesn't get buried inside "All". `OrderDetailPage.tsx` — amounts breakdown (item/shipping/
tax/total/commission/seller-net, there's no line-item array in the data model, just these
aggregate fields, so that's what's shown), buyer/seller ids, shipping/tracking state, a
force-deliver button gated to `status === 'SHIPPED'` and a refund form gated to
`['PAID','SHIPPED','DELIVERED','COMPLETED']` — both ranges read directly off
`order-status-transition.rule.ts`'s `CONFIRM_DELIVERY`/`REFUND` transition tables, not guessed.
Refund calls go through the API client's `idempotent: true` path (the backend's `IdempotencyGuard`
requires it on this route). New shared `admin-portal/src/components/{formStyles.ts,Section.tsx}`
for button/input/section styling, used by this phase's pages — **not** retrofitted onto Phase 1's
`ApplicationDetailPage.tsx`, which keeps its own copies; refactoring that file was out of this
phase's scope, noted here instead of done opportunistically.

**Verified live**: `npx tsc -b` (frontend) and `npx tsc --noEmit` (backend) both clean. Hit the new
`GET /admin/orders/:id` directly — 200 with full order data for a real fixture order, 404 for a
nonexistent id. Then a full headless-browser pass against the real API: Orders list renders all 8
tabs and correct `$X.XX` amounts (minor-units math confirmed: `1500` → `$15.00`); force-delivered a
test order from `SHIPPED` → `DELIVERED` (set to `SHIPPED` via a throwaway Prisma script first,
since no fixture order was in that state and driving one through the full catalog→sale→pay→ship
pipeline was out of scope just to exercise this button — the script was deleted immediately after,
not part of the app) — UI correctly showed `Confirmed by: ADMIN`; issued a $5.00 partial refund on
a separate `PAID` order — success banner, correct amount. **`GET /admin/audit-log` confirms both**
(`order.force_delivered` with `after: {status: "DELIVERED"}`, `order.refunded` with
`after: {amount: "500"}` and the typed reason).

**Not exercised**: the `DISPUTED` highlight styling — no fixture order has ever reached that
status, so the red-highlight code path rendered zero times live. It's a simple conditional style,
same low-risk class as Phase 1's unexercised document-viewer link; flagged rather than claimed as
verified.

## Phase 3 — Payouts and ledger (DONE, verified live)

**Backend**: new route `GET /admin/payouts` in `admin.controller.ts`, new DTO
`list-payouts-query.dto.ts`, new `PayoutsService.listPayouts()`/`AdminService.listPayouts()`
methods. **One real deviation from the plan's literal instruction, found and flagged rather than
silently followed**: the plan said to mirror `list-orders-query.dto.ts`'s shape (optional
`status`), but `PayoutRepositoryPort.findByStatus` (unlike orders' equivalent) has no "all
statuses" mode — `ListByStatusFilter.status` is non-optional. There's no "All" view this route
could honor, so `status` is **required** here, not optional; a missing `status` now correctly
400s (confirmed live) instead of either crashing or silently defaulting to one status and calling
it "all". Documented inline in both the DTO and `PayoutsService.listPayouts()`. API restarted to
pick up the new route.

**Frontend**: single `PayoutsPage.tsx` (the plan groups payout runs / failed-held payouts /
reconciliation under one "Payouts" nav item, so one page, three stacked sections, not three
routes). `admin-portal/src/api/payouts.ts` (typed wrappers, `Payout`/`PayoutRun`/
`ReconciliationReport`/`BalanceMismatch` hand-mirrored from the backend entities/
`ledger.service.ts`). Section 1: payout runs table + "Trigger payout run" button (labelled as
using the mock transfer adapter, no real money moves — same honesty pattern as other
known-mock surfaces). Section 2: payout list with 6 status tabs (Failed/Held/Pending/Processing/
Sent/Reversed — no "All" tab, matching the backend gap above) and an inline "Hold" action shown
only on `PENDING` rows. Section 3: the reconciliation report, with **both required gap-flags
surfaced in the UI itself**, not just in this file: "Ledger vs. processor totals: not implemented
yet" (quoting the backend's own `NOT_IMPLEMENTED` status) and "Payout holds are one-way. There is
no 'release' route yet."

**Verified live**: `npx tsc --noEmit` (backend) and `npx tsc -b` (frontend) both clean. Confirmed
the required-status deviation directly — `GET /admin/payouts` with no `status` 400s, with
`status=FAILED` returns `200` with an empty list. Full headless-browser pass: triggered a real
payout run from the UI (mock adapter, `payoutsCreated: 0` since no fixture order had actually
accrued a seller-available ledger credit — the run pipeline itself is confirmed working, not
faked), created one `PENDING` payout as a throwaway Prisma fixture (deleted immediately after, not
part of the app — same pattern as Phase 2's `SHIPPED`-order fixture), found it under the Pending
tab, held it, watched it disappear from Pending and reappear under Held with no Hold button.
**`GET /admin/audit-log` confirms `payout_run.triggered` and `payout.held`.** Reconciliation
section rendered correctly with real data (`ok: true`, 1 seller checked, both gap-flag notes
visible — screenshot confirms).

**Not exercised live**: a payout actually reaching `FAILED`/`SENT`/`PROCESSING`/`REVERSED` status
— the mock transfer adapter's failure path and the other tabs were never hit with real rows, since
no fixture order had an available ledger credit to pay out for real. Same low-risk, flagged-not-
claimed treatment as previous phases' unexercised paths.

## Phase 4 — Streams/chat moderation + audit log (DONE, verified live)

**Backend**: zero changes, confirmed zero needed. `GET /streams/live`, `POST /admin/streams/:id/
kill`, `POST /admin/chat/messages/:id/delete`, `GET /admin/audit-log` all already existed and
worked. The Phase 1 suspend-action flag note ("suspending does not currently end live streams or
hold payouts automatically") was already added back in Phase 1 — re-checked, still there, nothing
to add here.

**Chat moderation has no REST history endpoint anywhere** (confirmed against `05-API-SPEC.md`'s
full route table, not just the code — chat is WS-only, the only HTTP surface is the admin delete
route). Rather than build a "moderation" page that can't actually show any messages, or invent a
list-messages route the plan didn't call for, the Streams page **connects to the real
`main.realtime.ts` Socket.IO server as a genuine WS client** (`socket.io-client`, new dependency)
using the exact same `room.join` contract and `room:${sessionId}` convention the mobile app's
`StreamingGateway`/`ChatGateway` already expose — no new backend, just a real client of existing
infrastructure. Selecting a live stream joins its room and shows messages live as they arrive,
with inline delete. The UI says plainly that it can only show messages sent while the panel is
open, not history — a real, flagged limitation, not a fake "no messages" empty state pretending to
be complete.

**New frontend**: `admin-portal/src/api/streams.ts`, `src/api/auditLog.ts`, `src/lib/realtime.ts`
(the socket.io-client wrapper), `src/routes/streams/StreamsPage.tsx` (live/scheduled stream list +
kill + the embedded live-chat panel), `src/routes/audit-log/AuditLogPage.tsx` (actorUserId/
targetType filter form + paginated table). `AuthContext.tsx` gained one new export,
`getAccessToken()`, since the WS handshake needs a raw token the request-oriented `apiClient`
doesn't expose directly.

**A real, previously-undocumented backend gap found live, not guessed**: `POST /admin/streams/:id/
kill` currently fails for every single live session in this environment with a 500. Traced to the
real cause via the API's own log, not assumed — `KillSessionUseCase` calls
`LiveKitStreamProviderAdapter.endRoom()` unconditionally before updating the session's own status,
and LiveKit's API rejects it with "Unauthorized: invalid API key" because `.env`'s
`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` are still the literal placeholder value `replace` (per
`09-DECISIONS.md`'s open **D-005**, the video-provider decision was never actually made). Checked
directly: all 22 `LIVE` fixture sessions have a `providerRoomId` set, so this isn't an edge case —
the kill action cannot succeed against this environment at all today. Surfaced as a visible note
on the Streams page itself (not just here), and added to `prompt.md` §5a's known-gaps list since
it's a real finding a future session needs immediately, not something to rediscover. Not fixed —
no real LiveKit credentials available, and changing `KillSessionUseCase`'s error-tolerance would be
a backend behavior change outside this "no new backend" phase's scope.

**Needed bringing up a second backend process this session**: `main.realtime.ts` (port 3001) had
never been started this session (only `main.api.ts` was running from earlier phases) — the Streams
& Chat page's WS connection needs it. Brought up the same way `main.api.ts` already was (`set -a;
. ./.env; set +a; npx ts-node src/main.realtime.ts`). Noted in `prompt.md` §3 since the existing
"bring the backend up" instructions only mentioned the API process.

**Verified live**: `npx tsc -b` clean. Full pass with a second, independent `socket.io-client`
connection (a throwaway Node script, deleted after — same pattern as prior phases' throwaway
fixture scripts) acting as a real viewer: joined the same stream's room as the admin page, sent
three real chat messages over the real WS server, watched all three land in the admin UI in real
time. Deleted the spam one through the UI — it flipped to "deleted" locally and
`chat_message.deleted` landed in the audit log with the real message id as `targetId`. Confirmed
the audit log's own search works both unfiltered and filtered to `targetType=ChatMessage`, finding
exactly the one relevant entry. Kill was exercised too — see the LiveKit finding above; the action
reaching the right backend call and failing for a real, traced reason counts as verified behavior,
not a skipped check.

## Phase 5 — Real analytics backend + dashboard (DONE, verified live — last phase, plan complete)

Real new backend work, as scoped — not a thin wrapper:

- `GET /admin/analytics/orders-summary` — day-bucketed order counts + revenue (PAID/COMPLETED
  only), via `AnalyticsPrismaRepository.ordersSummary()` using Prisma `$queryRaw` with Postgres
  `date_trunc` (Prisma's `groupBy` can't date-truncate directly).
- `GET /admin/analytics/orders-by-status` — plain `groupBy` on `Order.status`, counts only.
- `GET /admin/analytics/sellers-summary` — `groupBy` on `Seller.status` + `date_trunc`-bucketed
  approvals-over-time off `Seller.approvedAt` (confirmed it's set correctly at approval —
  `SellerPrismaRepository.approve()`), via the same shared `bucketByDay()` raw-SQL helper
  `ordersSummary` uses, not duplicated.
- `GET /admin/analytics/payouts-summary` — `groupBy` on `Payout.status`, counts + summed amounts.
- New files: `src/modules/admin/domain/entities/analytics.entity.ts`,
  `domain/ports/analytics.repository.port.ts`, `infra/repositories/analytics.prisma.repository.ts`
  (the shared bucketing helper lives here), 4 files under `application/queries/`
  (`get-{orders-summary,orders-by-status,sellers-summary,payouts-summary}.query.ts`) plus a shared
  `analytics-range.util.ts` for the from/to default-window resolution, and
  `api/http/dto/analytics-range-query.dto.ts`. All wired into `admin.module.ts`/`AdminService`/
  `admin.controller.ts` following the exact existing `AuditLogRepositoryPort`/`ListAuditLogQuery`
  precedent (port → Prisma repo → query class → service facade → controller route), not a
  shortcut. API restarted to pick up the 4 new routes.

**The "Analytics time granularity" open decision is now resolved for v1**: `granularity` accepts
only the literal `'day'` in the Zod schema (`z.literal('day').optional()`) — anything else 400s
cleanly instead of being silently ignored. Week/month bucketing isn't built; this makes that gap
explicit rather than claiming support that doesn't exist.

**A real default-window decision, flagged not hidden**: no doc gives a default date range for the
dashboard, so `from`/`to` default to the trailing 30 days when omitted (same "reasoned, flagged
default" treatment as the bid-increment/offer-expiry placeholders elsewhere in this codebase) —
documented in `analytics-range.util.ts`'s own comment.

**A real revenue-definition question found while testing, not guessed past**: the plan's own text
says revenue counts `PAID`/`COMPLETED` orders only. Live data showed this excludes `SHIPPED`/
`DELIVERED` orders — which already collected payment at the `PAID` transition, so this likely
_undercounts_ real revenue. Built exactly as the plan specified rather than silently widening the
status set on our own judgment (that's a business decision, not an engineering one) — but
surfaced directly in the dashboard's own UI with a visible note, not just buried here, so it gets
caught before anyone trusts the number for real. Worth a founder decision before relying on this
figure. Separately: `date_trunc('day', …)` buckets in whatever timezone the Postgres session is
configured for (not forced to UTC) — noticed real bucket boundaries landing at 18:30Z, consistent
with an IST session default; not a bug, just worth knowing if a "day" boundary ever looks off by
several hours.

**Frontend**: `admin-portal/src/routes/analytics/AnalyticsPage.tsx` — a 7/30/90-day range picker,
2 stat tiles, and 6 charts (revenue-over-time line, orders-over-time line, orders-by-status bar,
seller-approvals-over-time line, sellers-by-status bar, payout-totals-by-status bar), each backed
by one of the 4 new endpoints directly — no client-side summing of raw lists, per the plan's own
requirement. Loaded the **dataviz skill** before writing any chart code (per its own trigger) and
followed it: picked line charts for magnitude-over-time and bar charts for categorical breakdowns
(never a pie, never dual-axis — revenue and order-count are two separate charts, not one chart
with two y-scales); colors come from the skill's own pre-validated 8-hue categorical palette
(`admin-portal/src/lib/chartColors.ts`), used unmodified and in a fixed per-status order so a
status keeps the same color across every chart, never reassigned by what's present; two
single-series time charts shown together (revenue vs. orders, approvals) use the skill's "second
sequential context takes the next categorical slot" rule (blue then orange) rather than both
defaulting to the same hue.

**A real layout bug found and fixed during live verification**: the leftmost bar's x-axis label
clipped off-screen in both bar charts — "PENDING_PAYMENT" rendered as "DING_PAYMENT", and the
`APPROVED` bar (67 sellers, the tall one) had no visible label at all, only the tiny `REJECTED`
bar did. Root cause: zero left margin on the chart plus no `XAxis` padding, so a label wider than
half the first bar's width overflowed past the chart boundary. Fixed with `margin.left: 16` and
`padding={{ left: 20, right: 20 }}` on all three bar charts; re-verified live, screenshot confirms
every label fully visible.

**Verified live**: `npx tsc --noEmit` (backend) and `npx tsc -b` (frontend) both clean. Hit all 4
new routes directly with real data (real revenue/order-count numbers, real seller approval
counts and dates, real payout totals) before ever touching the UI. Full headless-browser pass:
logged in, opened Analytics, confirmed all 6 charts actually rendered real SVG marks (3 line
series, 3 bar series, 6 bars, 5 dots — not empty placeholders), switched the date range from 30 to
90 days and confirmed the page re-fetched and re-rendered without error. Screenshot confirms the
whole dashboard reads cleanly end to end, including the revenue-definition flag note.

- **Keyed by `sellerId`, not `userId`, throughout** — so a future seller-team/multi-user model
  (see "Seller portal" note below) doesn't force re-plumbing which dashboards exist per seller.

**All 6 phases of the accepted admin-portal plan are now done and verified live.** See the summary
at the top of this file and `prompt.md` §6 for what that means for a future session — there's no
more "next phase" in this plan; what's left is the list of flagged, not-yet-resolved gaps
scattered through this file and `prompt.md` §5a, any of which could become real follow-up work.

## User management — Phase C (DONE, deployed live + verified, 18 Oct 2026)

New admin capability: listing/searching users, viewing a user detail, suspending/reinstating.
Backend routes (all in `admin.controller.ts`, `@Roles('ADMIN')`, audit-logged like every other admin
action): `GET /admin/users` (search `q`, `status`, `platform`, `role`, cursor pagination),
`GET /admin/users/:id`, `POST /admin/users/:id/suspend`, `POST /admin/users/:id/reinstate`.

- **Backend**: `ListUsersQuerySchema` DTO, `AdminService` facade methods, and — after an
  eslint-boundary catch — the reads/writes live in a new `AdminUserPrismaRepository`
  (`infra/repositories/admin-user.prisma.repository.ts`) behind a new `ADMIN_USER_REPOSITORY` port;
  `AdminUserSummary`/`AdminUserDetail` read models moved to `admin/domain/entities/admin-user.entity.ts`.
  Platform detection: `primaryPlatform` = the user's most-recently-seen device's platform, `UNKNOWN`
  when they have no devices. Detail view adds devices list, seller status/type, addresses,
  `paymentCustomer` (`providerCustomerId`, keyed by `userId`), team memberships, order count
  (standalone `order.count` on `buyerUserId` — `User` has no direct orders relation), address count.
  `npx tsc --noEmit` and `npx eslint` clean on all touched files.
- **Known gap, flagged not filled**: `hasSupportTickets`/`supportCategory` query params are accepted
  and passed through but not applied to the query — they'd need a help-module join. Don't build
  support-ticket filter UI against them until the backend actually filters.
- **Frontend (18 Oct 2026, verified `tsc --noEmit` clean; live check: served + routed, see deploy
  section below)**: `admin-portal/src/api/users.ts` (typed wrappers +
  hand-mirrored `AdminUserSummary` shapes) and `admin-portal/src/routes/users/UsersPage.tsx`,
  wired as a `Users` sidebar item between `Applications` and `Orders`. Table columns: user
  (display name + email, "Seller" chip when `isSeller`), role, status pill, platform badge
  (derived `primaryPlatform`, iOS=blue/Android=green/Web=purple/Unknown=neutral), joined date,
  actions. Filters: committed-text search (`q`, applied on Enter/button) + status tabs
  (All/Active/Suspended/Deleted) + platform and role dropdowns; cursor "Load more" pagination.
  Suspend/Reinstate use the repo's standard inline two-step confirm (no `window.confirm`), with
  in-place row status update; DELETED users show no action. A static note states plainly that
  suspension doesn't end live streams or hold payouts (same honesty pattern as Phases 1/3).
  **Deliberately NOT built this sub-phase**: no support-ticket filter UI (backend ignores those
  params — see the gap note above) and no detail page (`GET /admin/users/:id` is available for a
  future follow-up, nothing needs it yet). Scope note: this page lives in `admin-portal/` (the
  standalone Vite admin app, per the tracked architecture decision) — the phase brief's original
  `frontend/src/screens/admin/` path does not exist and was not invented.
- **Not exercised in-browser against a running API** (flagged honestly): the Users page has been
  deployed and survives a real `/users` SPA route check on admin.swishfy.com, but it has not been
  _driven_ in a browser (Docker Desktop being down the whole session meant no local run, and the
  live portal is a single SPA bundle — HTTP 200 on the route proves it ships, not that the page
  renders its data correctly). Confidence is "typechecked + follows the exact
  ApplicationsPage/ReviewsPage patterns + the underlying endpoints are verified live above".
  Next session with either stack up should drive it: login as an admin, search/filter,
  suspend and reinstate from the UI, and confirm the row pill flips and both
  `user.suspended`/`user.reinstated` entries appear in `GET /admin/audit-log`.
- **Deployed live to EC2, 18 Oct 2026 (same day)** — the whole Phases A/B/C batch plus all fixes
  went out in commits `1bc6304`, `1c1aa60`, `11ace7a`. Two deploy-blocking defects were found and
  fixed en route:
  - **Boot crash**: the team-phase edge `SellersModule → NotificationsModule` closed the
    Sellers ↔ Notifications ↔ Channels import triangle; the last edge evaluated to `undefined` at
    boot and Nest died with `module at index [5] is undefined` — api was CRASH-LOOPING on prod for
    ~5 minutes. Fixed with `forwardRef()` on all three cycle edges (Nest's documented escape
    hatch) in `1c1aa60`. Not covered by tsc/eslint — module cycles only fail at runtime boot.
  - **Second boot crash**: `SellerTeamGuard` was registered as an `AuthModule` provider but injects
    `SellersService` — unresolvable there. Moved the provider registration into `SellersModule`
    (its only consumer is `sellers.controller.ts`; AuthModule importing SellersModule would be a
    platform→business edge that also re-closes the cycle) in `11ace7a`.
  - **Migration drift**: `20261018140439_add_stream_moderation` failed at step 0 (`CREATE TYPE`)
    because identical tables/enums/indexes already existed in prod (schema drift from an earlier
    `db push`- style session; `_prisma_migrations` had 0 applied steps). Verified the live
    `StreamModerator`/`ChatTimeout` schema matches the migration SQL exactly
    (`\d+` comparison: columns, defaults, all 5 indexes, same FK cascades) before running
    `prisma migrate resolve --applied`. Post-resolve: `Database schema is up to date!`
- **Live verification, 18 Oct 2026, prod (api.swishfy.com), all passing**:
  - `GET /v1/admin/users?limit=5` → 200, real users with `primaryPlatform`/`isSeller`/`sellerStatus`.
  - `GET /v1/admin/users/:id` → 200, detail includes `orderCount` (was the broken runtime field
    pre-refactor), `devices`, `teamMemberships`, `addressCount`.
  - `POST /admin/users/:id/suspend` on demo user → detail shows `status: SUSPENDED`;
    `POST .../reinstate` → `ACTIVE`; `GET /admin/audit-log?action=user.suspended` shows both
    `user.suspended` and `user.reinstated` entries with correct `after` payloads.
  - Admin-portal live at admin.swishfy.com: root and `/users` route both 200; app-web (swishfy.com)
    200; `/health/ready` → ok.
  - All 7 containers up; 0 error-level log lines across api/realtime/worker in first 5 min.
- eslint note: the root eslint config only targeted `**/*.ts`, so admin-portal `.tsx` pages have no
  lint pass and never have — `npx tsc --noEmit` (via the 8GB `NODE_OPTIONS` form) is the gate, same
  as every prior admin-portal phase. On 18 Oct `admin-portal` was also added to the root eslint
  `ignores` (alongside `frontend`) so lint-staged stops choking on admin-portal `.ts` files at
  commit time.

## Seller portal — explicitly out of scope for all of the above

The founder's "YouTube studio"-style seller portal (inventory, stats, payout-cycle visibility,
team invites with roles) is future-only, conceptual, not built here. The one real interaction to
track: `Seller.userId` is a hard `@unique` 1:1 today (`prisma/schema/sellers.prisma`) — nothing in
this admin-portal plan touches that shape or assumes 1:1 user↔seller anywhere load-bearing except
Phase 5's analytics, which is deliberately keyed by `sellerId` for exactly this reason.

## Verification approach (per phase, once building starts)

Exercise every action in a phase's "Demo target" against the real running backend (Postgres +
Redis up, API running — same dev setup this whole project already uses), then confirm
`GET /admin/audit-log` shows the corresponding entry. Phase 5 specifically: hit each new
`/admin/analytics/*` route directly first and confirm correct bucketing/sums before wiring the
chart, not after.
