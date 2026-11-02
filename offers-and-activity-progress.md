# offers-and-activity-progress.md: "Make an Offer" on live + seller offer inbox, Activity separated out (local-only, never committed)

Started 16 Oct 2026. See `prompt.md` §15 for the full handoff context (founder's own words, confirmed
findings, file pointers, ground rules) — this file is the phase-by-phase (and sub-phase-by-sub-phase)
status tracker, same discipline as `live-features-progress.md`/`deploy_progress.md`/`admin_progress.md`.

**Working in phases, broken into smaller sub-phases named per phase (`1a`, `1b`, `2a`, `2b`, …) —
stop after every sub-phase, report what
changed, update this file, wait for "continue" before starting the next one.** This is a refinement
on the §14 arc's workflow: stopping only between the four top-level phases still lost work to a rate
limit once before §14 even started. Smaller stops, more often. The user runs every git command
themselves.

---

## D-series — Discover category real photos (18 Oct, NEW task after the offers/Activity arc shipped)

Founder: category pills on Discover must show **real images, Whatnot style — explicitly NOT emoji, NOT AI imagery**. Reference is a Whatnot "Browse by Category" page (3D-render tiles + viewer counts).

**Decisions locked (user, 18 Oct):**

- Layout: **no styling change** — same pills, images replace the icons inside them.
- Image source: **agent sources licensed stock** (Unsplash License — free commercial use, no attribution required). Whatnot's own images are copyrighted = untouchable.
- Where they live: **frontend static map** keyed by real slugs. No `Category.image` schema field, no migration, no admin UI. Swapping a photo = asset + rebuild.
- Viewer counts stay the already-flagged `placeholderWatching()` hash — no real per-category aggregation exists anywhere.

**Data verified live off `GET /v1/categories`:** 6 top-level slugs (fashion-accessories, electronics, home-living, beauty-personal-care, collectibles-toys, sports-outdoors), each with 2 children. Category schema has **no image/icon field** (id/parentId/slug/name/position/isActive only).

**Found-and-fixed while here:** `CATEGORY_ICONS` key `"fashion"` was stale vs the real slug `"fashion-accessories"` — Fashion had been silently rendering the generic grid glyph (the long-flagged §10 drift, confirmed on disk, now corrected).

| RS-#  | Sub-phase                           | What happened                                                                                                                                                                                                                                                                                                                                                                                     | State         |
| ----- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| DRS-1 | D1a — source + verify images        | 6 Unsplash photos (200×200 square crop) into `frontend/assets/categories/`, **each visually read back and content-matched**; rejected a gardening scoop (read "gardening", not Home & Living) and a book-market stack (read "books"). Final set: handbag / headphones / furniture showroom / makeup flat lay / vintage tin toys / basketball. Photo IDs recorded in the map's provenance comment. | ✅            |
| DRS-2 | D1b — wire static map + render      | `shared.tsx`: new `CATEGORY_IMAGES` (slug → `require()` asset); `CategoryRow` renders a 26×26 rounded `Image` instead of the 22px `Icon` when a photo is mapped, icon fallback kept for unmapped future slugs; stale `fashion` key → `fashion-accessories`. One shared component → **mobile + web inherit automatically**. No other styling touched.                                              | ✅ /fun clean |
| DRS-3 | D1c — build + verify both platforms | Not started. Browser pass on deployed web; app build on device. **Cannot visually verify until user runs the build/deploy.**                                                                                                                                                                                                                                                                      | ⬜ pending    |

**Not done / flagged:**

- The 12 child categories have no images (row only ever showed top-level; unchanged).
- Photo style is mixed (a couple of moody shots) vs Whatnot's uniform light tiles — founder chose "don't change styling"; a tile-style restyle is a later discussion if wanted.

**Purchases feed (NEW, approved 18 Oct, held):** founder asked "do we have a feed of purchases on streams?" and approved the **Recent-buyers ticker** for live streams (history of the last N purchases per session, replay on late join, both platforms). Waiting-green-light-but-held: **build starts only when the user says so.** Facts confirmed in code before asking: the moment-of flash already exists (`sale.resolved` → `BidFeedback` WinMoment/"just bought" row); nothing persistent/replayable exists (no endpoint, no session purchase history).

## F-series — Recent-buyers ticker SCOPE (cut 18 Oct, start on the user's explicit go in a NEW session)

Founder's shape (18 Oct voice note): activity-feed feel, "**maybe three or four at a time**"; a nice way for potential buyers to see that people are buying. Under the stream, both platforms (app + web 768px rule).

**Facts verified before scoping (18 Oct):** purchases already broadcast the moment they happen — `sale.resolved.v1` room push → `useLiveReel.ts` builds `WinMoment {winnerName, finalAmount, mode}` → `BidFeedback.tsx` renders "{Name} won it!" (auction) / "{Name} just bought this · $X" (BUY_NOW/OFFER). **Nothing persists or replays**: no purchase history per session, no list endpoint, no WS collection the client can append to across joins. Winner's display name: `useLiveReel` already expects `winnerName` on the push payload — its presence/resolution in the room payload must be re-verified in F1 (the event comment says the payload "isn't resolved there", so where names come from needs pinning down before any UI).

**Approach:** replay-able historical info already EXISTS as data — each purchase is a RESOLVED Sale with a winner tied to a stream session. No new table, no migration. The work is (1) a small read endpoint + (2) a client feed that seeds from it on join and appends from the existing `sale.resolved` push live.

**Key uncertainty F1 must resolve (flag-first, no invention):** exact linkage Sale→stream session (check `03-DATA-MODEL.md` Sale/stream columns in `prisma/schema/sales.prisma` + `stream-queue-item`), and whether the room push carries the winner's display name or only an id. If the endpoint name below isn't in `05-API-SPEC.md`, that's a new route the user authorizes as part of this scope (it's a read of public info — resolved sale amount and winner display name are already public the instant they happen).

| RS-#  | Sub-phase             | What                                                                                                                                                                                                                                                                                                                                       | State           |
| ----- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| FRS-1 | F1 — backend history  | Verify Sale↔session linkage + winner-name availability; new read endpoint `GET /v1/streams/:sessionId/purchases` (last ~20 resolved sales: winner display name, amount, mode, product, resolved time; Zod at boundary; rate-limit consistent with other public reads); update `05-API-SPEC.md` + `03-DATA-MODEL.md` only with what's real. | ⬜ next session |
| FRS-2 | F2 — client feed hook | `usePurchaseFeed(sessionId)`: seed from F1 endpoint on join, append from `sale.resolved` push, dedupe, cap length (e.g. keep last 30, show 3–4). Both platforms get it via one hook.                                                                                                                                                       | ⬜              |
| FRS-3 | F3 — ticker UI        | Compact "Recent buyers" rows (InitialsAvatar + name + what/amount), anchored near the existing win-moment area; per founder: 3–4 visible at a time, oldest scroll off; app + web (768px breaks to the app's layout); do NOT double-render on top of the full win moment — the ticker complements, never replaces it.                       | ⬜              |
| FRS-4 | F4 — closeout         | Full fun+be typecheck, tracker update, user deploys, browser pass on live app; deploy includes api+realtime containers this time (backend change), **no migration expected**.                                                                                                                                                              | ⬜              |

**Stewardship flag (founder already approved the concept):** the ticker shows buyer **display name + product + amount** — all of which are already public at resolve time. No contact info, no order data. If the founder ever wants amounts hidden, that's a one-line change later.

---

## Phase A — Search Page UI Fix (COMPLETE, 18 Oct)

Founder's ask: "Clicking on the search box goes to a search page that's confusing — search page could show products more in a good way rather than a search drop-down." Also: "What's the point of the box if it goes to a page which isn't visually put together."

**Scope:** Fix desktop web search page (`Search.web.tsx`) — remove redundant sidebar search bar (query comes from navbar), show query display card, add sort chips (Relevance/Price Low→High/Price High→Low/Newest), add category filter chips (placeholder), client-side filter/sort via `useMemo`, better empty/loading states. Mobile parity: add sort dropdown to `SearchMobile.tsx`. Visual polish: `ProductCard` larger images (1.2 aspect), press/hover feedback.

**Files:**

- `frontend/src/screens/marketplace/Search.web.tsx` — full rewrite
- `frontend/src/screens/marketplace/SearchMobile.tsx` — added sort dropdown
- `frontend/src/components/commerce/ProductCard.tsx` — larger images, press/hover states

**State:** ✅ Typecheck clean (backend + frontend)

---

## Phase B — Seller Stream Moderation (COMPLETE, 18 Oct)

**Scope:** Seller can add/edit/remove moderators for their streams; mods can timeout users from chat.

**Backend:**

- Models: `StreamModerator` (sessionId, userId, addedBy, role), `ChatTimeout` (sessionId, userId, moderatorId, expiresAt, reason)
- Enums: `StreamModeratorRole` (MODERATOR), `ChatTimeoutReason` (SPAM/HARASSMENT/INAPPROPRIATE/OTHER)
- Repositories: Prisma implementations with full CRUD
- Commands: `AddModeratorUseCase`, `RemoveModeratorUseCase`, `TimeoutUserUseCase`
- Queries: `ListModeratorsQuery`, `ListTimeoutsQuery`
- Service: `StreamingService` exposes all + `isUserTimedOut()`
- Controller: 5 REST routes with `JwtGuard` + `DefaultRateLimitGuard`
  - `POST /streams/:id/mods` (channel owner)
  - `DELETE /streams/:id/mods/:moderatorId` (channel owner)
  - `GET /streams/:id/mods` (channel owner)
  - `POST /streams/:id/chat/timeout` (mods + channel owner)
  - `GET /streams/:id/chat/timeouts` (channel owner)
- Docs: `05-API-SPEC.md` §6 updated

**Frontend:**

- API: `frontend/src/api/streams.ts` — moderation calls
- UI: `ModerationContent.tsx` — moderator list (add/remove), timeout form (duration, reason), active timeouts list
- Portal: Added "Moderation" rail item with shield icon, auto-fetches live session

**Files:**

- `prisma/schema/streaming.prisma`, `schema.prisma` — models + enums
- `src/modules/streaming/domain/entities/stream-moderation.entity.ts`
- `src/modules/streaming/domain/ports/stream-moderation.repository.port.ts`
- `src/modules/streaming/infra/mappers/stream-moderation.mapper.ts`
- `src/modules/streaming/infra/repositories/stream-moderator.prisma.repository.ts`
- `src/modules/streaming/infra/repositories/chat-timeout.prisma.repository.ts`
- `src/modules/streaming/application/commands/add-moderator.usecase.ts`
- `src/modules/streaming/application/commands/remove-moderator.usecase.ts`
- `src/modules/streaming/application/commands/timeout-user.usecase.ts`
- `src/modules/streaming/application/queries/list-moderators.query.ts`
- `src/modules/streaming/application/queries/list-timeouts.query.ts`
- `src/modules/streaming/application/streaming.service.ts`
- `src/modules/streaming/api/http/streams.controller.ts`
- `src/modules/streaming/api/http/dto/stream-moderation.dto.ts`
- `frontend/src/api/streams.ts`
- `frontend/src/screens/seller/ModerationContent.tsx`
- `frontend/src/screens/seller/SellerPortal.web.tsx`
- `05-API-SPEC.md` §6

**State:** ✅ Typecheck clean (backend + frontend)

---

## Phase C — Admin Panel User Management (IN PROGRESS, 18 Oct)

Founder's direction: Single section, categorize by support ticket issue types (not web vs mobile). User list with search/filter, column for "primary platform" (derived from last login device), filter by support categories (billing, streaming, orders, account, etc.), quick actions: view profile, suspend, message.

**Backend — Done:**

- DTO: `ListUsersQuerySchema` with filters (q, status, platform, role, supportCategory)
- Service: `listUsers()` (platform detection via devices table), `getUserDetail()` (full profile), `suspendUser()`/`reinstateUser()` (with audit logging)
- Controller: 4 routes with audit logging
  - `GET /admin/users` — list with all filters
  - `GET /admin/users/:id` — user detail
  - `POST /admin/users/:id/suspend` — suspend user
  - `POST /admin/users/:id/reinstate` — reinstate user

**Backend — Type Errors Remaining (5):**

1. `DevicePlatform` import missing in admin.service.ts
2. `paymentCustomer` select uses `providerCustomerId` not `stripeCustomerId`
3. `UserCountOutputTypeSelect` — remove `orders` (User model has no direct orders relation)
4. `AdminUserDetail` interface — update `paymentCustomer` to match Prisma (`{ userId, providerCustomerId }`)
5. `getUserDetail()` — fix `paymentCustomer` mapping, remove `orders` from `_count`

**Frontend — Not Started:**

- Admin panel user management table with platform badges, filters, suspend/reinstate actions

**Files:**

- `src/modules/admin/api/http/dto/list-users-query.dto.ts`
- `src/modules/admin/application/admin.service.ts`
- `src/modules/admin/api/http/admin.controller.ts`
- `05-API-SPEC.md` §11 (to update)

**State:** 🔄 Type errors blocking; frontend pending

## Summary — 18 Oct 2026 End State

| Phase    | Feature                  | Status                                         | Key Files                                                                            |
| -------- | ------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| F-series | Recent-buyers ticker     | ✅ COMPLETE                                    | `streams.controller.ts` (GET /purchases), `usePurchaseFeed.ts`, `PurchaseTicker.tsx` |
| A        | Search Page UI Fix       | ✅ COMPLETE                                    | `Search.web.tsx`, `SearchMobile.tsx`, `ProductCard.tsx`                              |
| B        | Seller Stream Moderation | ✅ COMPLETE                                    | `stream-moderation.*`, `ModerationContent.tsx`, `SellerPortal.web.tsx`               |
| C        | Admin User Management    | 🔄 BACKEND DONE, 5 TS ERRORS                   | `admin.service.ts`, `admin.controller.ts`, `list-users-query.dto.ts`                 |
| —        | Frontend Admin UI        | ⬜ NOT STARTED                                 | —                                                                                    |
| —        | Seller Team Management   | ⬜ QUEUED (awaiting founder role confirmation) | —                                                                                    |
| —        | E4 Activity on App Home  | ⬜ BLOCKED (awaiting founder)                  | —                                                                                    |

**Next for GLM:**

1. Fix 5 TypeScript errors in `src/modules/admin/application/admin.service.ts`
2. Build frontend admin user management UI (`frontend/src/screens/admin/UserManagement.tsx`)
3. Then: Seller team management (after founder confirms roles)

---

## E-series — Founder feedback batch (18 Oct voice memo, `convo.txt`)

Founder's asks, mapped to sub-phases. **Task 6 (app/TypeScript setup guide) excluded — user confirmed it was a different thing.** Tasks 1 & 3 are small wins batched first; task 2 next; task 4 (seller portal, YouTube-Studio-style) is its own multi-sub-phase build; task 5 (activity entry on app home) is **ambiguous — relay to founder before building** (the app already has the 6th Activity tab from phase 3b).

| RS-#  | Sub-phase                           | Founder ask                                                                                                                                                                                                                               | What happened                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | State                          |
| ----- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| ERS-1 | (done before this series)           | Bell separate from chat on web + clickable Activity page                                                                                                                                                                                  | Phase 3b of the offers/Activity arc — live in the 18 Oct deploy. Show the founder before treating this as undone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | ✅ deployed                    |
| ERS-2 | E1a — delete profile filler card    | Task 1: "Your next favorite is out there / Explore live shows… that doesn't need to exist"                                                                                                                                                | Removed the promo Card from `ProfileMobile.tsx` and the web `Profile.web.tsx` DesktopProfile; dropped the now-unused `Card` imports on both. Mobile + narrow web + wide web all lose the card.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | ✅ /fun clean                  |
| ERS-3 | E1b — profile single list, mobile   | Task 3: profile "should be a single list… not split into sections like Your collection and Make it yours, header-wise makes no sense"                                                                                                     | `ProfileMobile.tsx`: both `Section` headers dropped; the 8 MenuRows (collection items then payment/addresses/settings) now flow as one flat list, order unchanged; `Section` import removed; wrapper View restores the 28px top breathing room the old header carried. Narrow web (phone-width) inherits via the shared mobile path. FYI note: the list's "Settings" row still duplicates the top-right gear IconButton — pre-existing, untouched.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ✅ /fun clean                  |
| ERS-4 | E1c — profile single list, wide web | Same task on the 2-column desktop layout (co-founder's 16 Oct "split pages" request stays; only the section headers go).                                                                                                                  | `Profile.web.tsx` DesktopProfile: both `Section` headers dropped, right 420px column is one flat 8-row list matching mobile; column gets the small top offset the headers carried; `Section` import removed. 2-column split itself kept per the 16 Oct co-founder ask.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | ✅ /fun clean                  |
| ERS-5 | E2 — web nav bar alignment          | Task 2: logo far left, then "you still have this gap… it's kind of centered… all this white space on the left and right of the nav bar" — wants links next to the logo / right-aligned, not centered                                      | `MainTabNavigator.web.tsx`: the desktop search bar was deliberately CENTERED inside all remaining bar space (≈250–300px symmetric dead gaps on wide screens) — that was the "centered" look. Now anchored LEFT after the nav links; logo → links → search pack leftward, residual space collects before the right actions. The 1280 container cap kept — it's what keeps the navbar's left edge aligned with page content's left edge; un-capping it would indent all content vs the logo. **If the founder still dislikes the margins OUTSIDE the bar on >1440 monitors, that's a separate full-bleed decision (would need content uncapping too) — flagged.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | ✅ /fun clean                  |
| ERS-6 | E3-series — seller portal rebuild   | Task 4: YouTube-Studio model — Sell opens the dashboard directly; no giant Go Live button; left rail = Dashboard / Go Live / Schedule Stream / Orders…; right pane swaps on the fly; "reformat this whole page, not just the studio page" | **E3a done:** full inventory mapped (SellHub web/mobile, DesktopDashboard + DashboardMenu, the 10 seller routes + CONTROL). **Decisions (user):** rebuild is **desktop-web-only** (mobile keeps the stacked layout; phone-width web keeps the app look); **Go live embeds ControlRoom in the pane** (eventually). **E3b done:** new `SellerPortal.web.tsx` — left rail (Dashboard / Go live / Schedule show / Inventory / Orders / Offers / Payouts / Bank / Profile / Reviews, icon + active-pill styling) + right pane swapping on local state; Dashboard pane default (compact Go live / Schedule / Create listing buttons + balance card; **mock analytics numbers deliberately NOT re-shown** in the portal — no real seller-analytics endpoint exists, was flagged inline on the old page); `SellHub.web.tsx` desktop path now renders the portal and the old `DesktopSellHub` (giant Go-live tile page) is deleted. **E3c done:** real content in the first three management panes — `SellerOrdersMobile` / `InventoryMobile` / `SellerOffersMobile` each split into an exported Screen-free `…Content` component (chips + cards body) and the existing `Screen` wrapper, so native + narrow web render unchanged and the portal panes reuse the exact same content; `BUILT_PANES` = dashboard, orders, inventory, offers; offers reload-on-entry works (pane remounts on switching back; header refresh via remount-key bump, mobile chrome unchanged). **E3d done (batch deploy-ready):** every rail item is now an in-portal pane — Bank / Profile edits (`SellerBankAccountContent`, `SellerProfileEditContent {onSaved}` — save no longer calls `app.back()` unless the mobile wrapper passes it), Payouts / Reviews (`PayoutsContent`, `ReviewsContent` extracted from the `Settings`-inline screens, the three Screen-per-state branches collapsed into one Screen + content), Schedule pane (`CreateShowContent {onDone}`, pane switches to dashboard after scheduling — the wizard is still explicitly mock, unchanged), **Go live pane = embedded bare `ControlRoom`** (new `bare` prop swaps the Screen chrome for plain children; Sheet is an RN `Modal` so overlays still work from inside a pane). No rail item jumps out of the portal anymore; legacy routes (ROUTES.CONTROL etc.) continue as deep links via SellerNavigator. **E3e done:** full final `tsc --noEmit` clean; Sheet-in-bare-pane verified (Modal portals to top); DRS-3-style browser pass pending below. **Mobile app untouched by the whole E3 series** (desktop-web-only per user decision); phone-width web keeps the app's Sell tab. | ✅ series complete, /fun clean |
| ERS-7 | E4 — activity on app home           | Task 5: "should be accessible in the app via the home screen… I don't know how that would work. Maybe we have a separate thing there"                                                                                                     | Blocked on a founder answer — the mobile app already has the standalone Activity tab; ask if that's not enough / what he pictures.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ⬜ ask founder first           |

## Phase table

| Phase | What                                                                                                                                                                                                                   | Status                                                                                                                                                                                                                                                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | "Make an Offer" on the live stream (a real "more" menu or equivalent entry point, wired to the existing `submitOffer` flow `SaleActions.tsx`/`useLiveReel.ts` already have)                                            | Code-complete, **TYPECHECKED CLEAN** (backend 18 Oct, after fixing 5 strict-flag errors in `list-seller-offers.query.ts` — see Phase 2 write-up). Pending: live verification (real stream + OBS broadcast)                                                          |
| 2     | Seller offer-response screen (list pending offers on my items, Accept/Reject/Counter via the existing `POST /offers/:id/respond` route — confirm first whether a list-pending-offers query already exists server-side) | Code-complete (2a, 2b, 2c), **TYPECHECKED CLEAN** (backend 18 Oct: 5 strict-flag fixes in `list-seller-offers.query.ts`; frontend 18 Oct: 1 missing-import fix in `InboxRows.tsx`). Pending: real verification                                                      |
| 3     | Activity separated into its own nav entry + dedicated screen (placement decided 17 Oct 2026 — mobile 6th tab, web split icons; see 3a below)                                                                           | 3b build DONE, **TYPECHECKED CLEAN** (frontend 18 Oct, one pass covering 1f's tail + 2c + 3b + 4b/4c). 3c polish pending                                                                                                                                            |
| 4     | Notification mark-all-read + delete (both need new backend routes — neither exists today)                                                                                                                              | 4a+4b+4c DONE, **TYPECHECKED CLEAN** (18 Oct: `prisma generate` run first so the client carries `deletedAt`; backend needed the same 5-fixes pass; frontend needed the `InboxRows.tsx` import). Pending: deploy (migrate deploy REQUIRED for 4c), live verification |

Reorder/combine phases if a better split becomes obvious once inside the code — this split is a
starting point, not a constraint.

## Decisions needed (flag here, don't guess silently)

- **Where does Activity live in the nav? RESOLVED by the user, 17 Oct 2026 (see 3a below): mobile
  = a 6th "Activity" tab in the bottom bar; desktop web = a bell icon split out from the
  chatbubble, badges split too. Both platforms, per the standing sync rule (user confirmed the
  same day this is NOT web-only work).**
- **What does "delete" a notification actually mean?** `NotificationDelivery` has no soft-delete
  column today. A new `deletedAt` column + migration vs. some other mechanism — a real schema
  decision, not a frontend-only one.
- **Does a seller pending-offers list query already exist?** `prompt.md` §15 confirmed the two
  offer-response use cases exist but didn't find a list query in the same search pass — check before
  assuming a new one is needed.
- **Exact shape of the live "more" menu** — new dedicated button, or folded into the existing
  Share/Wallet/Shop action rail column — a layout judgment call.
- **NEW, the real Phase 1 blocker — how do offers interact with a live sale's mode?** §15 assumed
  this was "surface the existing offer flow on live," but reading the backend shows it is **not
  frontend-only**. `SubmitOfferUseCase` (`src/modules/sales/application/commands/submit-offer.usecase.ts:60`)
  **throws a raw `Error`** unless `sale.mode === 'OFFER'`, and:
  - `CreateSaleCommand`/`CreateSaleSchema` _do_ support `mode: 'OFFER'` at creation, but **no
    frontend path creates one** — the seller's `ControlRoom.tsx` `ModeToggle` only offers
    `BUY_NOW`/`AUCTION`, and `QueueItemMode` is explicitly `'AUCTION' | 'BUY_NOW'`.
  - `SwitchSaleModeCommand` (`switch-sale-mode.usecase.ts:13-27`) does **not** support `OFFER`, so a
    live sale can never be switched _to_ OFFER mode either.
  - Net: **no live sale can be in OFFER mode today**, so a live "Make an Offer" button calling
    `submitOffer` on an AUCTION/BUY_NOW sale would hit that raw throw → **500 INTERNAL_ERROR**, not
    a clean rejection.
  - Two real readings: **(A) OFFER becomes its own selectable live mode** (seller picks "Offer" per
    item; needs backend `SwitchSaleMode` OFFER support + the seller picker + the live panel's OFFER
    branch) vs. **(B) offers allowed on any open sale** (backend change to `submit-offer`, contradicting
    the existing "OFFER is a distinct mode" design, with real semantics questions).
  - **RESOLVED by the user, 16 Oct 2026: option (A).** OFFER becomes its own selectable live mode,
    same as Auction/Buy Now today. Build: `SwitchSaleModeUseCase` gains `OFFER` as a valid target
    mode, the seller's live mode picker (`ControlRoom.tsx`'s `ModeToggle`, and wherever
    `QueueItemMode` is typed as `'AUCTION' | 'BUY_NOW'`) gains a third option, and the live panels
    (`LiveProductPanel.tsx`, `LiveReelDesktop.tsx`) get a real `OFFER` branch instead of falling into
    the bid-button `else` (which would 500 via `placeBid` on an OFFER-mode sale, same raw-throw
    issue). No change needed to `submit-offer.usecase.ts` itself — it already does the right thing
    once a sale can actually reach OFFER mode.
  - Also confirmed: the live panels' current `else` branch renders bid buttons on **any** non-BUY_NOW
    sale, so an OFFER-mode sale reaching a live panel today would show "Custom Bid"/"Place a bid" that
    call `placeBid` → same raw-throw 500. The panel needs a real `OFFER` branch regardless.
- **ANSWERED — seller pending-offers list query does not exist.** `SalesService`
  (`application/sales.service.ts`) exposes only create/cancel/switch/placeBid/buyNow/submitOffer/
  respondToOffer/getSale/listPublicSales/listMyBids/listBids — no list-pending-offers. The
  `OfferRepositoryPort` has only `findById`/`create`/`respond`/`expirePending` — **no list method**.
  So Phase 2 genuinely needs a new repository method + query + controller route + frontend screen
  (plus a seller-side view shape for offers — none exists in `public-sale.view.ts` either).
- **Phase 4 pre-check:** `notifications.controller.ts` confirms only `GET /me/notifications` and
  `POST /me/notifications/:id/read` exist — no mark-all-read, no delete. `NotificationDelivery` has no
  soft-delete column (confirmed in §15; will need a schema decision in Phase 4).
- **Latent backend note (not fixed, out of scope):** the raw-throw pattern for "wrong mode" is
  deliberate and repeated in `place-bid.usecase.ts:95` and `buy-now.usecase.ts:47` (each commented as
  "a routing bug, not a user-reachable rejection"). So `submit-offer`'s throw is consistent with the
  codebase, not a new defect to fix — but it means a wrong-mode offer call is a 500 today.

## Phase write-ups (fill in as each phase/sub-phase lands)

### Phase 1 — Make an Offer on live

**Sub-phase 1a — investigate the live offer flow (no code written).** Confirmed against
the real code:

- `useLiveReel.ts:259-281` already builds `doSubmitOffer` and returns `submitOffer` — **never called**
  by `LiveReel.tsx` or `LiveReelDesktop.tsx` (matches §15).
- `LiveProductPanel.tsx` branches only `BUY_NOW` vs. else (Custom Bid / Place a bid); **no `OFFER`
  branch**. `LiveReelDesktop.tsx` is the same shape, hand-rolled (not the shared panel).
- `SaleActions.tsx:194-213` is the real reference implementation for the buyer offer UI (a `Field` +
  "Send offer" calling `submitOffer`, plus an `offer.responded` WS listener keyed on `offerId`).
- `POST /sales/:id/offers` (buyer) and `POST /offers/:id/respond` (seller) both exist
  (`sales.controller.ts:162-199`); WS `offer.submit` exists (`sales.gateway.ts:250-266`).
- **Blocker found** (see "Decisions needed" above): offers require `sale.mode === 'OFFER'`, and no live
  path can produce an OFFER-mode sale today. **Resolved by the user: option (A), OFFER is its own
  selectable live mode.**

**Sub-phase 1b — backend: OFFER as a switchable sale mode. DONE.**

- `src/modules/sales/domain/ports/sale.repository.port.ts`: `SwitchModeInput` gains
  `{ mode: 'OFFER' }` (no extra fields — mirrors how `submit-offer.usecase.ts` never reads
  `price`/`startAmount` for an OFFER sale).
- `src/modules/sales/application/commands/switch-sale-mode.usecase.ts`: `SwitchSaleModeCommand`
  gains an `OFFER` variant; the `switchMode` call branches to it.
- `src/modules/sales/infra/repositories/sale.prisma.repository.ts`: **no change needed** —
  `switchMode`'s existing ternary chain already falls through to "just bump mode + version" for
  any mode it doesn't special-case, which is exactly right for OFFER (no price/startAmount to
  persist).
- `src/modules/sales/api/http/dto/switch-sale-mode.dto.ts`: `SwitchSaleModeSchema` gains a bare
  `{ mode: z.literal('OFFER') }` variant.
- `src/modules/sales/api/http/sales.controller.ts`: `switchSaleMode` route branches a third way for
  `dto.mode === 'OFFER'`.

**Sub-phase 1c — backend: OFFER as a queue-plannable mode. DONE.**

Found while implementing sub-phase 1b: the decision text says "wherever `QueueItemMode` is typed as
`'AUCTION' | 'BUY_NOW'`" — that type lives in the **streaming** module (not sales), governing
`POST /streams/:id/queue` (add) and `POST /streams/:id/queue/:itemId/feature` (feature, which is
what actually calls `CreateSaleUseCase`). It explicitly excluded OFFER by name
("not a queue-plannable mode") before this. Updated:

- `src/modules/streaming/domain/entities/stream-queue-item.entity.ts`: `QueueItemMode` gains
  `'OFFER'`.
- `src/modules/streaming/infra/mappers/stream-queue-item.mapper.ts`: comment updated — the DB
  column already reuses the full `SaleMode` Postgres enum, so no schema change was needed, only
  the application-layer restriction.
- `src/modules/streaming/api/http/dto/add-queue-item.dto.ts`: `z.enum([...])` gains `'OFFER'`.
- `src/modules/streaming/api/http/dto/feature-queue-item.dto.ts`: discriminated union gains
  `{ mode: 'OFFER', currency }` (no price/startAmount, matches `CreateSaleCommand`'s existing OFFER
  variant).
- `src/modules/streaming/application/commands/feature-queue-item.usecase.ts`:
  `FeatureQueueItemCommand` gains an `OFFER` variant; the `createSale` call branches to it.
- `src/modules/streaming/api/http/streams.controller.ts`: `featureQueueItem` route branches a third
  way.

Confirmed no other change was needed: `room.state`'s `currentItem` enrichment and the
`sale.mode-switched`/`queue.item-featured` WS broadcasts already forward `sale.mode`/`sale.price`
generically (no `AUCTION`/`BUY_NOW`-specific code), so an OFFER-mode featured item already surfaces
correctly (`mode: 'OFFER'`, `price: null`) to viewers once one exists — no gateway change required.

**Sub-phase 1d — frontend: seller's mode pickers gain Offer. DONE.**

- `frontend/src/api/streams.ts`: `QueueItemMode` and `FeatureQueueItemInput` gain `OFFER`/
  `{ mode: 'OFFER'; currency: string }`.
- `frontend/src/api/sales.ts`: `SwitchSaleModeInput` gains `{ mode: 'OFFER' }`.
- `frontend/src/screens/seller/ControlRoom.tsx`: `ModeToggle` now offers Buy now / Auction / Offer.
  `submitFeature`/`submitSwitch` skip the "enter an amount" requirement and send a bare
  `{ mode: 'OFFER', currency: 'USD' }` / `{ mode: 'OFFER' }` when Offer is selected. Both Feature
  and Switch sheets show an explanatory line ("buyers submit their own offer amount...") instead of
  a price/starting-bid field when Offer is picked. Added a small `modeLabel()` helper (Auction/Buy
  now/Offer) used by the queue list and the "Currently featured" line, which previously hardcoded a
  two-way ternary that would have mislabeled an OFFER-mode item as "Buy now". `PriceLine` (the
  currently-featured item's price display) now has an OFFER branch instead of falling into the
  auction current-bid branch (which would have shown "— current" for a null `currentAmount`).
  `openSwitch` now seeds `formMode` from `sale.mode` directly instead of a `BUY_NOW`-or-`AUCTION`
  ternary that would have defaulted an OFFER-mode sale's switch sheet to Auction.
- **Not changed, a deliberate scope line**: the "Add to queue" sheet still hardcodes `"BUY_NOW"` as
  the mode when a product is first added (`handleAddProduct`) — it never offered a mode picker at
  add-time even for Auction, only at feature-time via `ModeToggle`. Feature-time still fully
  overrides whatever was planned at add-time, so this doesn't block picking Offer, it just means a
  freshly-added queue item is labeled "Buy now" until featured. Flagging this rather than silently
  expanding the add-sheet's scope — say if it should also get a mode picker.

**Not yet done at the time (resolved by sub-phases 1e/1f below): the live viewer-side panels.** `LiveProductPanel.tsx` and
`LiveReelDesktop.tsx` still only branch `BUY_NOW` vs. an auction-bid `else` — an OFFER-mode sale
reaching either today would still fall into the bid-button branch and 500 via `placeBid` (the
original blocker, just not yet fixed on the viewer side). This is the actual "Make an Offer" entry
point from the founder's ask — needs a real OFFER branch wired to `useLiveReel.ts`'s existing
`submitOffer`, using `SaleActions.tsx` as the reference implementation, per §15. Backend/typecheck
not yet run by me — give the user the commands below before continuing.

**Status: sub-phases 1a-1d done (backend OFFER-as-mode + seller pickers).**

**Sub-phase 1e — native live viewer panel gets a real OFFER branch. DONE, typecheck clean.**

- `frontend/src/hooks/useLiveReel.ts`: added `offerIdRef` (mirrors `saleIdRef`'s ref pattern so the
  non-resubscribing events effect can read it without re-subscribing) and a new
  `offerResponseNotice` ephemeral notice (same auto-clear shape as `outbidNotice`/`featuredNotice`,
  4s), fed by a new `offer.responded` listener using `offerResponseMessage()` from
  `realtime/sale-events.ts` — the exact same function `SaleActions.tsx` already uses for this on
  the product page, just never wired into the live hook before. `doSubmitOffer` now captures the
  real `offerId` the server returns (previously discarded) so the response can actually be matched
  to it. `offerIdRef` resets on every `loadItem` call (new featured item = any in-flight offer no
  longer applies). Returns `offerResponseNotice` from the hook.
- `frontend/src/components/live/BidFeedback.tsx`: `WinMoment` treated an accepted offer as an
  **auction win** (the big centered "won it!" moment) before this — wrong, since
  `respond-to-offer.usecase.ts` resolves an accepted offer exactly like a buy-now purchase (a real
  order, same commit path). Now `OFFER` renders the small buy-now-style "just bought this" row.
  This was a real latent bug, not just a missing branch — flagging it since it wasn't explicitly
  called out in the decision text.
- `frontend/src/components/live/LiveProductPanel.tsx`: new `onOffer` prop; a third action-area
  branch for `sale.mode === "OFFER"` — a single "Make an offer" button (same visual weight as the
  Buy Now button), replacing the `else` that used to fall through to bid buttons (the original
  500-risk branch).
- `frontend/src/components/live/LiveReel.tsx`: wires `onOffer` to a new "offer" sheet (same shape
  as the existing "custom bid" sheet — product photo/title, a `Field` for the amount, a "Send
  offer" button calling `live.submitOffer`). The main panel's `notice` prop now also includes
  `live.offerResponseNotice`. The win-moment gating that used to be `AUCTION` vs. `BUY_NOW` now
  treats `OFFER` the same as `BUY_NOW` (the purchase-style slot, not the auction-win slot).

**Next sub-phase (became 1f): `LiveReelDesktop.tsx` (web split-view) — hand-rolled, not the shared
panel, so needed the same OFFER branch built separately.** Stopping here to check in, per the
smaller-sub-phase workflow.

**Sub-phase 1f — web live panel (`LiveReelDesktop.tsx`) gets the identical OFFER branch. DONE.**

- `frontend/src/components/live/LiveReelDesktop.tsx`:
  - Third action-area branch for `sale.mode === "OFFER"` — a single "Make an offer" button (the
    shared `Button` component, same visual weight as the existing Buy now button), replacing the
    `else` that used to fall through to the bid buttons (the original 500-via-`placeBid` risk).
  - A new "offer" sheet, same shape as the native one in `LiveReel.tsx`: product photo + title,
    a "Your offer (USD)" `Field`, the accept/decline/counter explainer line, the `actionError`
    display, and a "Send offer" button calling `live.submitOffer(Number(custom))`. Reuses the
    existing shared `custom` string state (cleared on open), exactly like the confirm/custom bid
    sheets on this screen.
  - The notice line in the product block now includes `live.offerResponseNotice`
    (`outbidNotice ?? featuredNotice ?? offerResponseNotice`), matching the native panel's
    `notice` prop from sub-phase 1e. Same caveat as native: an accepted-offer message renders in
    the urgent-red notice style — a copy question already inherited there, not restyled here.
  - Win-moment placement now mirrors the native gating (`sale?.mode`, same discriminator the
    native panel uses): an AUCTION win keeps the big centered moment under the seller header
    (previously ungated); a BUY_NOW/OFFER purchase shows the small purchase row anchored
    bottom-left of the video (`purchaseRow` style, `position: absolute`). Deliberate placement
    adaptation, same component: native anchors the purchase row above the product panel, but the
    desktop panel is a light `canvas` background and `WinMoment` is white-text-with-shadow — on
    the video it stays legible and keeps clear of the bottom-right Share button.
- No hook changes were needed: `useLiveReel.ts` already returns everything this needs
  (`offerResponseNotice`, `submitOffer`, `winMoment`) since sub-phase 1e — both platforms share it
  unchanged.

**Phase 1 is now code-complete, but NOT verified.Sub-phase 1f's changes have not been typechecked
yet — the user runs: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` in `frontend/`
(backend untouched this sub-phase, its prior clean run still stands). Nothing has been verified
against the real deployed app (https://swishfy.com): putting a real sale into OFFER mode needs an
actual stream + OBS broadcast, not done by any session in this arc.**

### Phase 2 — Seller offer-response screen

**Sub-phase 2a — backend: repository method + query. DONE (no route yet — that's 2b).**

Investigated first, per the ground rules:

- **Confirmed against the entity: `OfferStatus` is `PENDING | ACCEPTED | REJECTED | COUNTERED |
EXPIRED | WITHDRAWN`** (the 2a plan's guess of five statuses missed WITHDRAWN — six total).
  Withdrawing isn't a buyer-side feature today, but the status exists, so the list filter accepts
  any of them.
- **`Sale.sellerId` is the approved `Seller.id`** (from `requireApprovedSellerId` in
  `create-sale.usecase.ts`), not `User.id` — so the offers list joins through `Sale.sellerId`, and
  the 2b route must resolve the auth user's `Seller.id` the same way (`requireApprovedSellerId` in
  the sales module) rather than using the raw user id.
- **No schema change needed**: filtering offers through `Sale.sellerId` is an existing index join
  (`@@index([sellerId, resolvedAt])` on Sale → offer's `saleId` relation). No migration.

Built, in dependency order:

- `src/modules/sales/domain/ports/offer.repository.port.ts` — NEW `ListSellerOffersFilter`
  (`sellerId`, optional `statuses` filter, cursor/limit) and `listBySellerId()` on the port.
- `src/modules/sales/infra/repositories/offer.prisma.repository.ts` — `listBySellerId()`
  implementation mirroring `BidPrismaRepository.findBySaleId`'s cursor shape exactly
  (`take: limit + 1`, `orderBy: createdAt desc, id desc` for a deterministic cursor,
  `cursor + skip: 1`).
- `src/modules/sales/application/queries/list-seller-offers.query.ts` — NEW, mirrors
  `list-my-bids.query.ts` (`CursorPage<Offer>` via `buildCursorPage`/`normalizeLimit`).
- `src/modules/sales/application/sales.service.ts` — `listSellerOffers()` facade method wired through.
- `src/modules/sales/sales.module.ts` — `ListSellerOffersQuery` registered as a provider.

**Sub-phase 2b — backend: route + seller-side offer view shape. DONE.**

One decision put to the user before the DTO was written (as promised in 2a): **what
`GET /seller/offers` returns when no status param is passed** — user picked **"Pending only"
(recommended)**: a plain GET is the actionable inbox; history needs an explicit comma-separated
`status` list (e.g. `status=ACCEPTED,COUNTERED`).

Built, in dependency order:

- `src/modules/sales/api/http/dto/list-seller-offers-query.dto.ts` — NEW. `status` is ONE
  comma-separated string (repeatable query params arrive as arrays only under some adapters;
  one invalid value 400s via `refine` rather than silently matching nothing), `cursor`/`limit`
  standard. All six statuses accepted. The query layer stays unopinionated; the **route**
  applies the default PENDING when the param is absent.
- `src/modules/sales/application/queries/list-seller-offers.query.ts` — REWRITTEN: the command now
  takes `sellerUserId` and resolves the seller itself via `getMySeller` — mirroring
  `ListSellerOrdersQuery` exactly, including **empty page, not an error, when the caller has no
  seller profile**. Returns a new `SellerOffer` read model: the raw `Offer` plus
  `saleCurrency`/`saleMode`/`saleStatus` (an offer carries no currency of its own; saleStatus
  gates the respond actions client-side), `product {id, title, condition, imageUrl}`, and
  `buyerDisplayName`. Cross-module calls go through application facades only (`CatalogService`,
  `IdentityService`, `SellersService`) — no domain/infra imports across modules; `StorageService`
  is platform-level like catalog's own controller uses. Per-offer enrich degrades honestly:
  unresolvable product fields go null, unknown buyer → null name, dropped row only if the sale
  itself is missing (corrupted state, FK-cascade impossible normally).
- `src/modules/sales/api/http/public-sale.view.ts` — NEW `SellerOfferView` + `toSellerOfferView`:
  money as minor-units numbers, ISO date strings, buyer as display name only (never a raw user
  id — the route is authenticated to the seller, but the view stays consistent with the sales
  gateway's display-name treatment).
- `src/modules/sales/application/sales.service.ts` — `listSellerOffers` return type now
  `CursorPage<SellerOffer>` (also fixes 2a's accidental un-imported `Offer` reference in this
  signature — caught while wiring 2b, wasn't typechecked in between).
- `src/modules/sales/api/http/sales.controller.ts` — NEW route `GET /seller/offers`
  (`JwtGuard` + `DefaultRateLimitGuard`, like `GET /seller/orders`), `statuses:
query.status ?? ['PENDING']`, view mapping via `toSellerOfferView`.
- `src/modules/sales/sales.module.ts` — `StorageModule` added to imports (first time the sales
  module needs it, for image URL resolution).

**Not in scope (deliberately):** no WS event when an offer arrives on the seller's side (the
screen polls or the 2c screen refreshes on entry — whether sellers get a push event was flagged in
the 2a plan as a real question, still open for 2c); no spec entry was added to
`05-API-SPEC.md` for this route — flagging the same non-spec addition the preferences/address
book routes were, user-directed feature.

- Typecheck has NOT been run for 2a+2b yet — the user runs it (backend command below) before 2c.

_Proposed sub-phase split (confirmed with the user before building, 17 Oct 2026):_

- **2a — backend: repository + query. DONE.** Add a list method to `OfferRepositoryPort` + the Prisma
  adapter (list offers by the seller's own sales, status-filterable), and a new application-layer
  query exposing it through `SalesService`. No route yet. Open detail to settle inside 2a: which
  statuses count as "pending" (the offer entity has PENDING/ACCEPTED/REJECTED/COUNTERED/EXPIRED —
  confirm against the actual entity before assuming), and whether the list also needs responded
  history or just live pending ones.
- **2b — backend: route + view shape. DONE** (default status = PENDING confirmed by the user,
  17 Oct 2026). New GET route for a seller's offers (likely
  `GET /seller/offers`), Zod DTO, controller route under the seller's own auth, and a seller-side
  offer view shape (none exists in `public-sale.view.ts` today) carrying product title/photo and
  buyer display name — flag any non-spec naming plainly.
- **2c — frontend: seller screen. DONE (code, untypechecked).**
  - Two 2c decisions put to the user first, 17 Oct 2026, both answered: **live update path =
    entry-refresh + a manual Refresh button** (no WS push for incoming offers exists — adding one
    is a whole backend event, deliberately out of this sub-phase; recommended plain entry-refresh,
    user picked the extra button) and **scope = Pending + History chips** (recommended, mirrors
    `SellerOrders`' tabs; History sends the explicit statuses list `ACCEPTED,REJECTED,COUNTERED,
EXPIRED,WITHDRAWN` — WITHDRAWN included per 2a's six-status reality; plain GET with no
    `status` param is left to use the route's own PENDING default for the Pending tab).
  - Built, in dependency order:
  - `frontend/src/api/sales.ts` — ADD: `SellerOfferProduct`/`SellerOffer` types mirroring the
    backend `SellerOfferView` exactly (minor-unit money, ISO dates, buyer as display name only,
    `saleStatus` gates the respond actions client-side); `listSellerOffers({ statuses, cursor,
limit })` (client-side `statuses` array serializes to the route's single comma-separated
    `status` query param — one DTO string per 2b's own comment); `respondToOffer(offerId, action,
counterAmount?)` posting `POST /offers/:id/respond` ({action} or {action, counterAmount} in
    minor units) returning `{offerId, status, counterAmount}`. Both flagged in-file as the same
    non-spec additions the 2b route was (`/seller/offers` not in 05-API-SPEC; respond itself is
    spec §7 but was never called by any client until now).
  - `frontend/src/screens/seller/SellerOfferCard.tsx` — NEW, the shared renderers (same split as
    the SellerOrders family): `SellerOfferRow` (light desktop list row: thumb, amount, item title,
    buyer, date, status badge) and `SellerOfferCard` (full card: product photo — real first image
    URL from the query, `image-outline` placeholder box on null, same honest treatment as
    `Photo`'s failed state; title; condition; buyer display name; amount + currency; received/
    expiry dates; "You countered at $X" line for COUNTERED). Respond actions render only when
    `status === "PENDING" && saleStatus === "OPEN"` — Accept / Counter / Reject buttons wired to
    `respondToOffer`; Counter opens an inline amount `Field` (dollars, `toMinor`-equivalent inline
    rounding to integer minor units), validation toast on empty/zero. Errors surface via
    `describeApiError` + toast, mirroring `SellerOrderCard`'s ship form exactly. Status badge
    colors: ACCEPTED = `colors.success`, REJECTED/EXPIRED = `colors.live` (red), WITHDRAWN =
    textSecondary, else brand — honest labels from a central `OFFER_STATUS_LABEL` map using the
    server's exact status strings.
  - `frontend/src/screens/seller/SellerOffersMobile.tsx` — NEW, the mobile layout (Single source
    of truth; web narrow-width reuses it). Chips (Pending default / History), one list, each card
    with its own accept/reject/counter. Reloads on tab change and via the Refresh `IconButton` in
    the `Screen`'s right slot. Exports `SELLER_OFFER_TABS` for the web build. On respond: Pending
    tab **removes** the offer (the server's PENDING list genuinely wouldn't return it next load —
    showing a card with no actions would be a lie), History tab updates it in place with the
    server's `{status, counterAmount}`.
  - `frontend/src/screens/seller/SellerOffers.tsx` — NEW, 1-line re-export of the mobile screen,
    native path (exact `SellerOrders.tsx` pattern, including the same comment).
  - `frontend/src/screens/seller/SellerOffers.web.tsx` — NEW: narrow → `SellerOffersMobile`;
    wide → `DesktopSellerOffers` master-detail (the exact `SellerOrders.web.tsx` treatment):
    light rows left, selected highlighted, full card + respond actions right, "Select an offer"
    placeholder before selection, selected offer leaves the list on respond so the placeholder
    returns.
  - Nav wiring: `constants/routes.ts` — `OFFERS: "offers"`; `RouteNavigator.tsx` +
    `SellerNavigator.tsx` — route → `<SellerOffers />`; `Seller.tsx` barrel export;
    `MainTabNavigator.web.tsx` — `ROUTES.OFFERS` added to the `wide` (1280px) list (the
    master-detail layout needs the width); `SellHubMobile.tsx` + `SellHub.web.tsx` — an "Offers"
    `MenuRow` ("Accept, reject, or counter buyer offers") placed directly above the Orders row in
    both platforms' studio right column.
  - Flagged, not invented: the only new names are `GET /seller/offers` (2b's own non-spec route)
    and the `ROUTES.OFFERS`/"Offers" nav label (design call made per the 2c assignment's blessing
    to match seller-family patterns). Counter semantics honored from the backend contract:
    accepting creates the real order server-side (`respond-to-offer.usecase.ts`), and a failed
    accept leaves a PENDING offer untouched — no optimistic UI beyond the post-success row
    update, toasts confirm each outcome.
  - Typecheck: run 18 Oct (user asked the agent to run it) — CLEAN after fixes: backend
    `list-seller-offers.query.ts` had 5 strict-flag errors (`statuses?` receiving an explicit
    `undefined` under `exactOptionalPropertyTypes` → key omitted when absent; readonly
    `SellerOffer['product']` field mutations → fresh object built; `sort()[0]` unguarded under
    `noUncheckedIndexedAccess` → guarded). One `tsc` pass covers 1f + 2c + 3b + 4b + 4c frontend.
    Live verification against production still pending for the whole arc.
- After each: stop, report, update this tracker, wait.

### Phase 3 — Activity separated out

- **3a — decision: DONE (user answered both questions directly, 17 Oct 2026).**
  - **Mobile: a 6th "Activity" tab in the bottom tab bar** (recommended option picked). Tap → the
    existing `Inbox({ activityOnly })` screen as a tab — title "Activity", no back button (as a
    tab, not a pushed route). **Badges split**: the Inbox tab's dot becomes unread **messages**
    only, the new Activity tab's dot is unread **notifications** only (today both are one combined
    dot, `MainTabShell.tsx:46`). The Inbox screen's "Activity" chip becomes redundant and is
    removed — the Inbox tab screen becomes Messages-only (title/label decision inside 3b:
    "Messages" vs. keeping "Inbox" as the label).
  - **Desktop web: split the single Inbox icon into chatbubble (Messages) + bell (Activity)**,
    each with its own unread dot (recommended option picked). The desktop Inbox _page_'s
    Messages/Activity two-column layout stays as-is for now; the bell routes to the dedicated
    Activity screen. Whether that dedicated screen needs its own desktop layout (vs. the narrow
    column) is decided inside 3b, following the `.web.tsx` pattern.
  - **Scope confirmed both platforms** (user question during 3a, clarified same day): this is NOT
    web-only work — the standing sync rule (web-design-progress.md, "any new feature must land on
    both app and web") applies. Web-narrow (phone-width browser) follows the mobile decision
    automatically via the `MainTabShell` fallback.
  - Build inventory for 3b, from reading the current code: `constants/routes.ts` (`TABS` gains the
    6th entry + `TabName` type extends), `MainTabShell.tsx` (switch case for the tab + per-tab
    badge split), `MainTabNavigator.web.tsx` (navbar bell + split dots + ACTIVITY routing), the
    pushed-Activity `activityOnly` variant loses its back button when used as a tab screen
    (prop tweak), `InboxMobile.tsx` (drop the Activity chip), `InboxNavigator.tsx` (unchanged for
    the pushed route), and the badge logic itself (notification-count hook already exists —
    `useNotifications`/`useMessaging` are already read separately in both shells; only the
    `unreadCount = A + B` sum line needs splitting).
- **3b — the chosen placement's frontend work. DONE (code, untypechecked — the user deferred both
  typechecks to a later run, so 3b sits unverified on top of the untypechecked Phase 1+2 diff).**
  Six files touched, in dependency order:
  - `frontend/src/constants/routes.ts` — `TABS` gains the 6th entry
    (`{ name: ROUTES.ACTIVITY, label: "Activity", icon: "notifications-outline",
selected: "notifications" }`, placed between Inbox and Profile); `TabName` extends with
    `(typeof ROUTES.ACTIVITY)`.
  - `frontend/src/hooks/useNavigation.web.ts` — **not in the 3b handoff inventory but required, a
    real gap it missed**: `PATH_BY_TAB`/`TAB_BY_PATH` are `Record<TabName, string>` maps, so the 6th
    tab name without an entry breaks `tsc` AND `/activity` URL restore (previously a stale pushed
    URL). Both maps gain `activity` → the Activity tab is a real URL (`/activity`) and old pushed
    `/activity` URLs now restore to the tab.
  - `frontend/src/screens/personal/InboxMobile.tsx` — the `Chips` ["Messages","Activity"] switcher
    is REMOVED: the Inbox tab screen is Messages-only (renders the conversations list),
    `activityOnly` renders only the notifications list. Title pick (flagged, the tracker's explicit
    open question): **kept "Inbox" as the Inbox tab screen's title** — the tab bar label is still
    "Inbox", the desktop Inbox page is titled "Inbox", and renaming to "Messages" would add a
    tab-label/screen mismatch for zero gain; say the word if you want "Messages" instead (one-line
    change). New `showBack` prop (default true): the pushed-Activity route (via `InboxNavigator`,
    now only reachable from stale `/activity` URLs) keeps its back button; `showBack={false}`
    suppresses it when rendered as a tab.
  - `frontend/src/navigation/MainTabShell.tsx` (mobile shell; web-narrow reuses it) —
    `renderRoute` gains `case ROUTES.ACTIVITY: return <Inbox activityOnly showBack={false} />`.
    Badge split (was `MainTabShell.tsx:46`'s sum + one INBOX-keyed dot at :163): the sum line is
    deleted; per-tab dots — Inbox tab dot = `unreadMessages`, Activity tab dot =
    `unreadNotifications`.
  - `frontend/src/navigation/MainTabNavigator.web.tsx` (desktop shell) — same sum deletion;
    `navActions` gains the bell `IconButton` (`notifications-outline`, label "Activity",
    `goTab(ROUTES.ACTIVITY)`) right after the chatbubble, each icon wrapped in its own dot View
    (chatbubble = messages, bell = notifications); `renderRoute` gains the same ACTIVITY case.
    `wide` list deliberately NOT extended: the Activity tab renders in the narrow reading column
    (see below).
  - `frontend/src/screens/personal/Inbox.web.tsx` — Desktop-layout decision (flagged, the tracker's
    explicit open question): the `activityOnly` variant keeps the mobile layout at every width — it
    is a single list, so on desktop it renders inside the shell's narrow reading column (the
    generic treatment decided centrally for single-list screens), NOT a bespoke desktop Activity
    layout. A real desktop Activity treatment can come with 3c alongside Phase 4's
    mark-all-read/delete buttons. The variant now accepts/forwards `showBack` (needed because
    `Inbox` consumers pass it through on web).
  - Unchanged, confirmed: `InboxNavigator.tsx` (pushed-route case stays for stale URLs;
    `<Inbox activityOnly />` keeps back by default), `useNavigationBase.ts` (nothing to change),
    `Inbox.tsx` 1-line re-export, `DiscoverMobile.tsx:43`.
  - **Behavior change, flagged**: `useNavigationBase.ts:12-15` tab-switches any name present in
    `TABS` — so Discover's in-page notifications bell (`DiscoverMobile.tsx:43`,
    `app.navigate(ROUTES.ACTIVITY)`) now switches to the Activity **tab** instead of pushing a
    back-buttonable route. The bell still works; it just lands in the new tab, which is arguably
    the right destination now that a dedicated tab exists. Discover shows its own bell while the
    bottom bar has an Activity tab too — a small redundancy, left in place (handoff said leave the
    path working); remove the Discover bell later if you want.
  - Hardware/software back from the Activity tab already behaves like every other tab (returns to
    Home) via the existing `BackHandler` in `useNavigationBase.ts` — no extra work.
  - Not done and deliberately out of 3b (Phase 4): mark-all-read, delete, and any Activity-screen
    polish. 3c is therefore mostly moot — the dedicated screen already renders; the remaining
    polish belongs to Phase 4.
- **3c — dedicated Activity screen** (the existing `Inbox({ activityOnly })` mode is the seed).

### Phase 4 — Mark-all-read + delete

- **4a — decisions: DONE 17/18 Oct 2026 (both user questions answered with recommendations picked).**
  - **Delete = soft delete**: a new nullable `deletedAt` column + one migration (same shape as the
    `readAt` migration `20261012030000_notification_read_state`). List/unread-count filter it out;
    the EMAIL send record (status/providerMessageId/failureReason) survives and the action is
    reversible. The user explicitly picked this over hard-deleting the row (the alternative put to
    them: hard DELETE destroys the send record, the notification system's only audit trail).
  - **Mark-all-read = all notifications**: `POST /me/notifications/read-all` sets `readAt` on every
    unread EMAIL delivery for the user (not just the loaded page), button on the Activity screen.
- **4b — mark-all-read: DONE (code, untypechecked; backend deploy pending).**
  - Backend, in dependency order: `notification.repository.port.ts` gains
    `markAllRead(userId): Promise<number>` (rows updated; idempotent — the filter is the same
    `{ userId, channel: 'EMAIL', readAt: null }` shape `markRead`/`countUnreadForUser` already
    use); `notification.prisma.repository.ts` implements it as a single `updateMany` returning
    `count`; `notifications.service.ts` gains `MarkAllNotificationsReadCommand` +
    `markAllRead()`; `notifications.controller.ts` gains
    `POST /me/notifications/read-all` (`JwtGuard` + `DefaultRateLimitGuard`, `@HttpCode(200)`,
    returns `{ data: { updated: number } }`; no DTO — the only input is the authenticated user,
    nothing to Zod-validate; flagged in-file as not in 05-API-SPEC.md). Route can't collide with
    `:id/read` (different segment counts).
  - Frontend, in dependency order: `api/notifications.ts` gains
    `markAllNotificationsRead(): Promise<{ updated: number }>`;
    `NotificationsProvider` gains `markAllRead()` in its context (calls the API, then
    `setUnreadCount(0)` — the provider stays the single owner of the badge);
    `useInboxData` gains `markAllRead()` — sets every loaded row's `readAt` optimistically, calls
    the provider's action, and on failure toasts `describeApiError` (badge keeps the server's true
    count because the provider call just threw; no rollback, same tolerance as `openNotification`
    — it's read state, not data the user acted on);
    `screens/personal/InboxMobile.tsx` puts a "Mark all read" `Pressable` (13px, brand color) in
    the `Screen`'s `right` slot — rendered only when `activityOnly` and at least one loaded item
    is unread, so the Messages-only Inbox tab never shows it.
  - Platform note: the button lives in the shared mobile layout, so the desktop Activity tab
    (narrow reading column) gets it identically; the wide desktop Inbox page's two-column Activity
    section does NOT get it this sub-phase (it reads a separate `useInboxData` instance anyway —
    flagged, not silently diverged; the bell routes to the dedicated Activity screen where the
    button lives).
- **4c — delete route + frontend: DONE (code, untypechecked — and note the backend `tsc` needs
  `npx prisma generate` first, since the mapper now reads `row.deletedAt` off the generated
  client).** Built per 4a's soft-delete decision, in dependency order:
  - `prisma/schema/notifications.prisma` — `deletedAt DateTime? @db.Timestamptz(6)` (nullable, NO
    new index: the existing `@@index([userId, createdAt])` already serves the inbox query's shape).
  - `prisma/migrations/20261017000000_notification_soft_delete/migration.sql` — hand-written,
    same single `ALTER TABLE ... ADD COLUMN` shape as the `readAt` migration it mirrors.
  - `notification-delivery.entity.ts` + `notification-delivery.mapper.ts` — entity gains
    `deletedAt: Date | null`, mapper carries it. `notification.view.ts` deliberately unchanged:
    a deleted row never appears in a list, so the view surface doesn't need it.
  - Port: `deleteNotification(id, userId): Promise<NotificationDelivery | null>` — soft delete
    only (sets `deletedAt`, never a hard remove); returns the row once deleted, null when no
    non-deleted EMAIL row with that id belongs to the user (a foreign id AND an already-deleted
    id read identically as NOT_FOUND — that choice is documented in the port comment).
  - Prisma adapter: `updateMany({ id, userId, channel: 'EMAIL', deletedAt: null } →
{ deletedAt: now })`; count 0 → null. **All user-facing filters now exclude deleted rows:
    `listForUser`, `countUnreadForUser`, `markRead` (both its statements), and `markAllRead`
    gained `deletedAt: null`** — deleted = out of the user's world entirely. NOT touched:
    `findDeliveryById`/`listDeliveriesForUser` (they have zero callers today — flagged, no
    behavior depends on them; filter them whenever they get a consumer).
  - `notifications.service.ts` — `DeleteNotificationCommand` + `deleteNotification()` returning
    `Result<void, NotificationNotFoundError>` (Err → 404 via the existing `toHttpException`,
    same as `markRead`).
  - `notifications.controller.ts` — `DELETE /me/notifications/:id` (`@Delete`, `@HttpCode(200)`,
    `JwtGuard` + `DefaultRateLimitGuard`, returns `{ data: { id, deleted: true } }`). No path
    collisions with the existing three routes (`:id/read` differs by method AND segments). No
    DTO — path param + authenticated user only. Flagged in-file as not in 05-API-SPEC.md.
  - Frontend api — `deleteNotification(id): Promise<{ id, deleted }>` (flagged non-spec comment).
  - `NotificationsProvider` — `deleteNotification(id, wasUnread)`: API-then-precise-decrement;
    the badge only drops if the deleted row was actually unread (the row was in hand, so no
    re-list needed). Import aliased `deleteNotificationApi` to avoid shadowing.
  - `useInboxData` — `deleteNotification(item)`: optimistic removal, but **with real rollback +
    toast on failure** — deliberately stricter than read-state tolerance because deletion is
    destructive (leaving list and server disagreeing would misrepresent state).
  - `InboxRows.tsx` — `NotificationRow` gains an OPTIONAL `onDelete` prop; when present, a
    trailing `IconButton` (trash-outline,
    secondary color, accessibilityLabel "Delete <title>"). Optional so a surface can stay
    read-only: **the desktop Inbox page's two-column Activity section does NOT get the delete
    button or the mark-all-read button** (flagged, not silently diverged — the bell routes to the
    dedicated Activity screen, where both actions live; extend the page later if wanted).
  - `InboxMobile.tsx` — the activityOnly branch passes `onDelete={() => deleteNotification(item)}`;
    the messages list does not. Empty-state after delete is free (`items.length === 0` →
    "No activity yet").
  - One-tap delete, no confirmation — deliberate (matches the app's lightweight confirmation
    posture; notification removal is low-stakes). Say the word if you want an undo/confirm step.
