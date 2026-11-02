# founder-feedback-round5-progress.md (local-only, never committed)

Started 26 Oct 2026, same day as round4 but a later, separate WhatsApp dump from the founder
(+1 (616) 337-0683, 6:56am-7:14am) — sent **after** round4's issues 1-4 were fixed, deployed, and
demoed to him live on a call. Round4 (`founder-feedback-round4-progress.md`) is now CLOSED — see its
own status header. This file is the current task.

**Status header — update this every session.**

**CLOSED, 27 Oct 2026. This file is now historical — the active file is
`founder-feedback-round6-progress.md`.** Everything below this header (including the "NEW, SEPARATE,
SERIOUS BUG" and the priority list) is stale; kept for the narrative only. Full closing summary:

- The DRAFT/ACTIVE bug: fixed for real — real image-upload UI (photo picker, upload/attach/list/
  detach wired to the existing backend endpoints) plus Activate/Deactivate buttons on the listing
  screen. Commit `3028093`. Deployed and confirmed live (the seller portal screenshot mid-session
  showed a real product reach ACTIVE status through the new flow).
- A live founder demo call happened this same day and surfaced a long chain of real live-viewer UI
  bugs, fixed one at a time, each shipped and confirmed on the founder's actual phone in near
  real-time: condition inline with title, single live title (moved around twice per changing founder
  direction, see round6's header for where it landed), win-moment repositioned, title alignment,
  category line (added then replaced with stream title per a later founder call), a real structural
  mobile-web bug (`MainTabShell`'s `maxHeight:960` phone-frame cap was wrongly applying to real
  phones), a second structural bug (the live reel's own height fallback subtracted 130px that was
  never actually reserved on the Live tab — found via a temporary on-device debug overlay since
  browser automation here could not reproduce real mobile Chrome's viewport behavior to debug it
  blind), and an icon-alignment fix. Commits `86078c2` → `a9d0eec` (9 commits), all deployed
  individually. The debug overlay itself has been removed again once confirmed fixed.
- Round5's original 6 founder items + the refresh-token race are **not individually re-verified**
  after all this — the live demo call moved straight into the new UI bugs above instead of finishing
  round5's own planned test checklist (two-tab repro, full auto-advance cycle, issue 6 purchase test,
  bid-button visual sequence). If any of those still matter, re-open them explicitly; don't assume
  done from this file alone.
- **A real new scope decision made this session, worth remembering:** shipping/tax has no real
  mechanism anywhere in the system (`shippingAmount`/`taxAmount` are hardcoded `0n` in
  `create-order-from-sale.usecase.ts`) — the live view now shows a flat "Free ship + tax" label as a
  placeholder, decided directly with the user rather than guessed. Revisit once real shipping/tax
  exists.

Original (now stale) status note from earlier this session, kept for context only:

**Per-issue status:**

- **Bonus: refresh-token race** — fixed, deployed (`bdbab83`). NOT yet confirmed with a live
  two-tab repro.
- **Issue 1 (title placement)** — no code needed. Needs the founder to look at the live build.
- **Issue 2 (web volume)** — built, deployed (`a491a8d`), confirmed rendering correctly on the real
  live viewer page.
- **Issue 3 (bid button constant state)** — built, deployed (`a491a8d`). Data/pricing side confirmed
  live; the full OPEN→ENDED→RESOLVED visual sequence not yet watched end to end.
- **Issue 4 (real-time refresh)** — investigated, no independent fix written. Hypothesis: same root
  cause as the refresh-token race. Needs the same live two-tab repro to confirm or rule out.
- **Issue 5 (automatic queue)** — built, deployed (`a491a8d` + migration `20261026120000_stream_
auto_queue`, applied on EC2). Toggle, queue pricing, and Feature-sheet pre-fill all confirmed live.
  The actual timed auto-advance-after-resolve cycle has NOT been watched happen — blocked by the bug
  below.
- **Issue 6 (verify bidding/purchases end-to-end)** — NOT done. Blocked by the bug below.

**NEW, SEPARATE, SERIOUS BUG found during live testing (not fixed yet, not part of the founder's
original six items): every product defaults to DRAFT and there is no way to ever activate it.**
`GetPublicProductQuery` hides anything non-`ACTIVE` from buyers ("not found"). `ProductPrismaRepository.
create()` never sets a status, so it falls to the Prisma schema default (`DRAFT`). The backend already
has a complete, working `publishProduct`/`unpublishProduct` pair on `CatalogService`
(`SetProductStatusUseCase`) — **zero frontend call sites use it.** A seller can list, queue, and
feature a product with no warning anywhere; the buyer gets "This product is no longer available."
This almost certainly predates round5 (no round5 code touches product status) and likely means every
freshly-listed product in production today is unsellable through the app. **This is next session's
first task** — see `prompt.md` for the fix plan.

**What actually got exercised live, 26 Oct 2026 (both test accounts logged in by hand — production
login, never automated):** seller portal + listing creation + Go Live + real IVS ingest card; the new
two-step "Add to the queue" flow with real stored pricing shown correctly in the queue row; the
Automatic Queue Paused/Running toggle round-tripping to the real API; `Switch mode` still working
post-migration; the Feature sheet pre-filling from stored queue pricing; the volume slider rendering
correctly on the desktop live viewer. A ~50-action screen recording was saved as
`C:\Users\91639\Downloads\round5-test-session.gif`.

**Still not done, in priority order for next session:**

1. Build, deploy (code-only, no schema change) and live-test the DRAFT/ACTIVE fix itself: create a
   listing, confirm it can't activate with zero photos (friendly error, not a 500), add a photo,
   activate, confirm the public product endpoint now serves it.
2. Live two-tab repro of the refresh-token race + issue 4 check (same repro covers both).
3. Full auto-advance cycle: toggle on, let a real sale resolve, confirm the next in-stock item
   features itself ~12s later with no manual tap.
4. Issue 6: real second-account bid + purchase, now actually possible once #1 is fixed.
5. Watch the bid button through its full OPEN→ENDED→RESOLVED sequence on a real sale.
6. Founder's own confirmation on issue 1.

**Test accounts** (production, real seeded accounts, not local): seller
`productionenterprise+seller@gmail.com`, buyer `productionenterprise@gmail.com`, password
`FounderAccess123!` for both. Both must be typed in by hand each session — production login is not
something to automate (see "Session discipline learned this session" in `prompt.md`).

---

## The founder's actual words (verbatim, trimmed to splits only)

1. "Title of Stream Appears Bottom Screen Mobile & Web"
2. "Volume Button on Web — Mute/Slide Volume"
3. "Title & Featured Item share the same text space — title appears upon first viewing the stream
   then after x amount of seconds transitions to the featured item product title. Or we feature
   title text at all times."
4. "Bid button should remain constant and text within the button should change depending on the
   state of the stream. Custom / max bid button should appear during auctions next to it."
5. "There's an error where the users stream being watched doesn't refresh in real-time"
6. "Title should always be visible on the stream above the featured product"
7. "Have an automatic feature product queue system. Sellers can pause and start the queue."
8. "Re-Arrange items in the queue"

Grouped below by what they actually mean, not 1:1 with the numbering above (several are the same ask
said two ways).

## Issue 1 — Title placement / always-visible above the featured product (msgs 1, 3, 6)

**Very likely already resolved, pending founder re-confirmation on the live build.** This is the
exact same ask as round4's title-placement work, just arriving independently via WhatsApp before he'd
seen the fix. What shipped this session (commits `e123e17` then `4de2cdc`, both deployed):

- Mobile (`LiveReel.tsx`, shared with the native app via `LiveMobileShell`): `LiveStreamTitle` now
  renders as its own always-visible line directly above `LiveProductPanel`, not sharing a slot with
  anything, no timer, no transition.
- Desktop web (`LiveReelDesktop.tsx`): title moved off the video overlay entirely, into the top of
  the right-side panel, directly above the product/bid block.

His msg 3 describes a timed title→product-title transition sharing one space — that mechanism isn't
in the current code at all (title and product info are two separate, simultaneously-rendered
elements), so this really should already be fixed. **Don't mark this done without having him
actually look at the redeployed build** — same trust issue he's already raised once this round.
One open question worth asking him directly: msg 1 says "bottom of screen" — on mobile that's
accurate (the overlay sits at the bottom), but there's no literal "bottom of video" on desktop since
video and panel are side-by-side columns; confirm the panel-top placement reads as satisfying this
for desktop specifically.

## Issue 2 — Web volume button: mute + slider (msg 2)

**Built (26 Oct 2026), typechecked, NOT yet deployed or exercised in a real browser (testing
deferred to the end of this round per the user's own instruction).** Found while investigating: this
only existed on mobile (tap-to-mute via `LiveReel.tsx`/`LiveMobileShell.tsx`); desktop web
(`LiveReelDesktop.tsx`) had `muted={false}` hardcoded with literally zero audio control of any
kind — not even tap-to-mute. That's the real gap this closes.

- `ReelVideo.web.tsx` and `ReelVideo.tsx` (native) both gained an optional `volume?: number` (0-1)
  prop, applied to `video.volume` / `player.volume` respectively (native: harmless parity, no caller
  passes a non-default value there — phones already have hardware volume buttons, this was never
  meant to be a native feature).
- `LiveReelDesktop.tsx`: added real `muted`/`volume` state (starts muted — same autoplay-with-sound
  browser restriction `LiveMobileShell.tsx` already documents for its own default), a mute-toggle
  icon, and a real `<input type="range">` slider (`VolumeSlider`, new local component in the same
  file) in the action rail next to Share/Wallet/Shop. Built imperatively via `document.createElement`
  — same precedent `ReelVideo.web.tsx` already set, since this repo has no DOM JSX intrinsics wired
  up and this screen only ever renders on web. No new dependency added.
- Moving the slider to 0 auto-mutes; unmuting restores the last volume.

**Still needed**: deploy (`app-web` only) and a real visual/interaction check in an actual browser —
not done yet, per the decision to batch testing at the end of this round.

## Issue 3 — Bid button always visible, text changes with state (msg 4)

**Built (26 Oct 2026), typechecked, NOT yet deployed or exercised (testing deferred to the end of
this round).** Found a real conflict before writing any code: round4 (23 Oct, confirmed founder
feedback) explicitly said never show a dimmed/placeholder button when nothing's featured; round5 msg
4 says the button should "remain constant" across "state of the stream," which read like it could
mean the opposite. Flagged this to the user directly instead of guessing — **decision: keep round4's
no-button empty state exactly as-is; only make the button a single constant element once an item HAS
been featured**, across `OPEN → ENDED (CANCELLED) → RESOLVED` for that one item. Not literally "all
states" as msg 4's words alone might suggest — a deliberate, asked-for scope narrowing, flag this to
the founder if he pushes back expecting the no-item case to have a button too.

What changed, in both `LiveProductPanel.tsx` (mobile) and the `productBlock` section of
`LiveReelDesktop.tsx` (desktop) — they duplicate this logic separately, same precedent round4's
title fix hit:

- The old plain-text "This item is no longer available." / "This sale has ended." (shown once
  `sale.status !== 'OPEN'`) is now a disabled button in the same slot/shape the live Buy-now/Offer/
  Place-a-bid buttons already occupy, labelled "Sold" (`RESOLVED`) or "Ended" (`CANCELLED`/expired).
- `BUY_NOW`/`OFFER`/open-`AUCTION` buttons are unchanged — they already had their own correct
  per-mode labels (confirmed, not rebuilt, per the tracker's own note that this part already worked).
- Custom Bid next to Place a bid during an open auction: unchanged, already correct, not rebuilt.
- The no-item-featured empty state (headline + subtext, round4's own fix) is untouched.

## Issue 4 — Viewer doesn't refresh in real time (msg 5)

**Investigated (26 Oct 2026), not independently code-fixed — most likely already addressed as a
side effect of the refresh-token race fix above, pending live re-verification.** Read
`frontend/src/hooks/useLiveReel.ts`, `frontend/src/screens/seller/ControlRoom.tsx`,
`frontend/src/providers/RealtimeProvider.tsx`, `frontend/src/realtime/sale-events.ts`,
`src/modules/streaming/api/ws/streaming.gateway.ts`, and `src/modules/sales/api/ws/sales.gateway.ts`
in full. The event-broadcasting/subscription wiring is structurally correct on both the viewer and
seller sides — `sale.resolved`/`sale.cancelled` go to `room:{sessionId}`, both screens join that room
and subscribe to the same events, and `applySaleResolved`/`applySaleCancelled` correctly flip
`sale.status` off `OPEN` the moment the event is applied. No logic bug found in that path.

**Working hypothesis: this is very likely the same root cause as the "bonus" refresh-token bug, not
a separate one.** `RealtimeProvider.tsx`'s socket re-reads `tokenStore.get()?.accessToken` fresh on
every reconnect attempt. Before today's fix, the refresh-token race could wipe tokens from
`localStorage` entirely — every reconnect would then auth with an empty token, fail, and retry
forever, silently, so the control room's socket would never rejoin the room and never receive
`sale.resolved`/`sale.cancelled`. This matches the exact trigger conditions noted for both bugs: same
test session, same two tabs, same "after the first auction completes, starting a second one" timing.
A compounding, separate small gap: `ControlRoom.tsx` never reads `realtime.status` at all — there is
no "reconnecting" indicator anywhere in it, so a seller has no way to notice the socket died; stale
data just sits there silently, exactly matching what was observed.

**Decision (asked the user directly, 26 Oct 2026): wait and re-test after deploy rather than write
new code now.** The refresh-token fix is already deployed (see above). Next step is a live two-tab
repro of the ORIGINAL refresh-token scenario post-deploy — if the control room stays live/current
through it this time, issue 4 was the same bug and this closes both at once with no new code. If it
still goes stale even with tokens intact, that's a real independent bug and the reconnect-indicator
gap above becomes the next thing to fix (not yet built, would touch `ControlRoom.tsx` only).

## Issue 5 — Automatic featured-item queue (msgs 7, 8)

**Built (26 Oct 2026), typechecked (backend + frontend), NOT yet migrated on EC2, deployed, or
exercised (testing deferred to the end of this round).** Re-arranging queue items (msg 8) was already
done, confirmed, untouched. Automatic advance + pause/start (msg 7) was genuinely net-new — three real
design questions were asked directly rather than guessed (answers below), plus one hard blocker found
and resolved before writing any code.

**Decisions (asked the user directly, standing in for the founder):**

- Auto-advance timing: a short grace period after an item resolves, not instant — **12s** picked as
  the concrete number (recommended "10-15s" range).
- Out-of-stock handling: **skip** to the next in-stock PENDING item, don't stop and wait.
- Pause scope: **per-show only** — a plain `StreamSession.autoQueueEnabled` boolean, resets to off
  on every new session, never a seller-level default.

**The hard blocker, found during design, not guessed past:** `StreamQueueItem` had no price/amount
field at all — the seller has only ever typed the real starting bid/price/quantity by hand at
feature-time (the "Feature" sheet). An automatic system has no seller to prompt. Asked the user
directly: **pricing now gets captured up front, when the item is added to the queue** (new
`startAmount`/`price`/`quantity` columns on `StreamQueueItem`, mode-conditional, mirroring
`FeatureQueueItemCommand`'s own discriminated union). The existing manual "Feature" flow is
unchanged in capability — it now pre-fills from this instead of starting blank, still fully editable.

**What actually changed:**

- Migration `20261026120000_stream_auto_queue` (hand-written, not generated via `prisma migrate dev`
  — no local DB per standing project rule; `npx prisma generate` was run locally to refresh
  `@prisma/client`'s TS types only, no DB touched): `StreamSession.autoQueueEnabled` (bool, default
  false), `StreamQueueItem.startAmount`/`price`/`quantity` (all nullable BigInt/Int).
- `AddQueueItemUseCase`/`AddQueueItemCommand`/its HTTP DTO: now a discriminated union by mode,
  storing the new pricing columns. Frontend `addQueueItem()` signature changed to match
  (`AddQueueItemInput`, mirroring `FeatureQueueItemInput`).
- New `ToggleAutoQueueUseCase` + `PATCH /streams/:id/queue/auto` (`{enabled}`) — the per-show
  pause/resume. Exposed on the public session view (`autoQueueEnabled`) so the control room can read
  current state on reload, same as every other session field it already reads that way.
- New `AutoAdvanceQueueUseCase` (`src/modules/streaming/application/commands/auto-advance-queue.
usecase.ts`): per session, no-ops unless `autoQueueEnabled && status === 'LIVE'`; if the active
  item's sale has resolved/cancelled and 12s have passed, walks the PENDING queue in order, skips
  anything missing its mode's required pricing (pre-migration rows) or out of stock, and calls the
  _existing_ `FeatureQueueItemUseCase.execute()` unchanged — resolving the real owning seller's
  `userId` first (new `ChannelsService.getChannelById` + existing `SellersService.getSellerById`) so
  this reuses the same code path a manual feature-tap uses, ownership check and WS broadcast
  (`queue.item-featured`) included for free, nothing new to wire there.
- `StreamReconcileProcessor` gained a second, faster repeating job (5s poll) for this, sharing the
  same Worker/Redis connection as its existing 60s liveness tick rather than standing up a new
  processor — a 60s poll on top of a 12s grace period would have turned "a short grace period" into
  "up to 72s," which isn't what was decided.
- `ControlRoom.tsx`: "Add to the queue" is now a real two-step flow (pick product → mode + price/
  quantity, reusing the same `ModeToggle`/`Field` markup the Feature sheet already had) instead of a
  single tap that silently defaulted to `BUY_NOW` with no price. A new "Automatic queue" card (Pause/
  Start button + status line) sits between "Currently featured" and "Queue". Queue rows now show the
  stored price/qty next to the mode label.

**Still needed before this is real**: the migration run on EC2 (`prisma migrate deploy`, not just
`db:generate`), a full deploy, and live exercise of the actual auto-advance behavior (two-tab test:
turn auto-queue on, let an item resolve, confirm the next one features itself ~12s later without a
manual tap) — none of that has happened yet, per the batched-testing decision for this round.

## Issue 6 — "Make sure bidding and purchase feed works correctly" (the user's own ask, not founder's)

**Not verified end-to-end this session — flagged honestly, not assumed working.** The Custom
Bid/Place a bid buttons are pre-existing, real functionality (not mocked — they call
`useLiveReel`'s `placeBid`, a real backend call), but no actual bid was placed and confirmed working
during this session's testing. Also worth knowing before testing again: **a seller cannot bid on
their own item** (`src/modules/sales/domain/errors/sales.errors.ts:40`, "Seller cannot transact on
their own sale") — testing a real bid needs a second, non-seller account.

**A separate, real bug was found while trying to test this**: a refresh-token race condition. See the
next section — fixed in code (26 Oct 2026) but not yet deployed or confirmed with a live repro, so
Issue 6's end-to-end bid verification should still wait until after this is deployed and re-checked,
not before.

## Bonus, found live (not from the founder) — refresh-token race across tabs

**Fixed (26 Oct 2026), uncommitted, typechecked, NOT yet deployed or re-verified against production.**
A direct curl-based repro against production (login + two concurrent `/auth/refresh` calls with the
same test buyer account) was attempted first, as this file asked for, but the auto-mode permission
classifier blocked the live network call before it ran — so this fix rests on code-level confirmation
only (both `client.ts` and `token-store.ts` independently confirm every piece of the hypothesis below:
the unconditional `clear()` on any failed refresh, the unguarded shared `localStorage`, and rotating
single-use refresh tokens per AGENTS.md's own stack table), not an observed real-world failure. If a
real two-tab repro is wanted before trusting this, it still hasn't happened — flag that explicitly,
don't claim "confirmed."

**The fix**, in `frontend/src/api/client.ts`'s `refreshTokens()`: on a failed `/auth/refresh`, instead
of immediately clearing tokens, retry reading the token store up to 3 times with a 150ms gap first. If
the stored refresh token has changed since the one this call sent, another tab already won the race
and rotated successfully — treat this as success (`return true`) and keep the newly-rotated tokens
instead of wiping them out from under the winning tab. Only clears (true failure, e.g. truly expired
session) if the stored token still matches what was just rejected after all retries. No new file, no
cross-tab messaging (`BroadcastChannel`/`storage` listener) added — `get()` already reads live
`localStorage` on every call, so a short poll was enough. Harmless on native (single-process token
store, no multi-tab concept — the retry loop just adds ~450ms before an already-correct clear on a
session that was genuinely dead anyway).

**Deployed (26 Oct 2026)**: committed, pushed, `app-web` rebuilt on EC2, health checks green
(`https://api.swishfy.com/health/ready` → `{"status":"ok"}`, `swishfy.com`/`admin.swishfy.com` → 200).
**Still needed before fully closing this out**: a real two-tab repro against production (two tabs,
same account, Network tab open on `/auth/refresh`, force both access tokens to expire close together)
to confirm the fix actually holds under a live race, not just a typecheck + healthy deploy.

Original hypothesis write-up, for reference: unauthorized
errors specifically after the first auction completed and a second one was being started, previously
recoverable only by a full logout/login. `frontend/src/api/client.ts`'s `request()` already retries
once on a 401 via `refreshOnce()`, and that in-flight lock is correctly a true singleton
(`frontend/src/api/index.ts` creates `api` exactly once) — so the lock works _within one tab_, but
each browser tab is its own JS process with its own copy of that lock, while
`frontend/src/api/token-store.ts`'s web implementation (`createBrowserTokenStore`) reads/writes
plain `localStorage`, shared across all tabs of the same origin with zero cross-tab coordination.
Refresh tokens are described as "rotating" (AGENTS.md's own stack table: "short access + rotating
refresh"), i.e. single-use. Hypothesis: with two tabs open under the same account (exactly what this
session's own testing setup used — a seller control tab and a viewer tab), if both tabs' access
tokens happen to expire close together, both independently call `/auth/refresh` with what they each
still think is a valid refresh token; whichever request the backend processes second gets rejected
(the first already rotated it), and `refreshTokens()` in `client.ts` calls
`options.tokens.clear()` unconditionally on any failed refresh — wiping the valid tokens the _other_
tab's successful refresh just wrote, since both tabs share the same `localStorage`. Needs an actual
repro with two real tabs and the Network tab open on `/auth/refresh` calls to confirm this before
writing a fix — don't patch blind. If confirmed, the fix is cross-tab coordination (a `storage` event
listener so a tab notices another tab already refreshed, or a `BroadcastChannel`), not just "retry
harder." The native app's token store (`createSecureTokenStore`) doesn't have this exposure the same
way — single process, no multi-tab concept — so this is likely web-only.

---

## Resume protocol

1. Read this file's status header.
2. Read `prompt.md` §26 (or whatever is the latest numbered section) in full before anything else —
   it's the literal continuation point and has the session-start checklist.
3. State: "Resuming at founder-feedback-round5: <issue>."
4. Work one issue at a time. The refresh-token bug and issue 4 (real-time refresh) are good
   candidates to do first — they're bugs blocking reliable testing of everything else, not new
   features, and issue 6 (verifying bidding) can't be trusted until the refresh-token bug is actually
   fixed, since a flaky session will look exactly like a flaky bid API otherwise.
5. Stop, report, update this file, wait for "continue" before the next issue — same discipline every
   prior round used.
