# streaming_progress.md: Live streaming (Amazon IVS) build tracker — LOCAL ONLY, never commit

Rewritten clean on 14 Oct 2026 — this file grew two overlapping numbering schemes while being
written live through the session; this version has exactly one (A-F), superseding both. If an
older copy of this file is ever seen again (it shouldn't be, it's gitignored-by-convention and
local-only), this one is authoritative.

**D-005 resolved 14 Oct 2026: Amazon IVS**, specifically **Classic (Channels: RTMP in, HLS out)**,
not Real-Time (Stages: WebRTC, per-participant billing) — the real shape here is one broadcaster
watched by many passive viewers, Stages is built for small interactive groups and would cost far
more at any real viewer count. See `09-DECISIONS.md`.

## Current status: A-F all done. This arc is complete except the two deliberately-deferred items.

| Phase | What                                                                              | Status                                 |
| ----- | --------------------------------------------------------------------------------- | -------------------------------------- |
| A     | `StreamQueueItem` schema + migration                                              | **DONE**                               |
| B     | Backend: queue management (add/reorder/feature)                                   | **DONE**                               |
| C     | Backend: live sale mode switching                                                 | **DONE**                               |
| D     | Backend: `room.state` current-item enrichment                                     | **DONE**                               |
| E     | Frontend: real `Live.tsx` (video, bidding, chat, current-item banner, win-moment) | **DONE, 14 Oct 2026 — see below**      |
| F     | Frontend: seller queue + go-live screen                                           | **DONE, 14 Oct 2026 — see below**      |
| —     | Phone-camera broadcast (needs EAS native build)                                   | Deliberately deferred, not in this arc |
| —     | Real IVS→EventBridge webhooks (reconcile polling covers it today)                 | Deliberately deferred, not in this arc |

## Phase F, done (14 Oct 2026)

Rebuilt `frontend/src/screens/seller/ControlRoom.tsx` (reached from `SellHub.tsx`'s "Go live"
button — the mock-preview comment that gated it on D-005 is gone) into a real go-live screen:
create + start a session (shows the real OBS ingest URL/stream key, with web clipboard copy and a
manual-copy fallback on native), add the seller's own products to the queue, feature an item
(auction or buy-now, with real pricing — the mode picked at add-time carries through to feature,
no redundant second mode choice), reorder with move-up/down (full-list `reorderQueueItems`, no
partial-reorder endpoint exists), switch the live item's mode without losing its bids, and end the
show. Resumes an already-live session on reload/reopen — there's no "my current session" route, so
it reads the way a viewer would (the seller's one channel via `listChannels({sellerId})`, then
whichever live session belongs to it) rather than losing track of a running show. If resumed this
way, the stream key isn't shown again (no route returns it after `/start`) — flagged plainly in the
UI rather than faked. New API functions added to `api/streams.ts` (createStream/startStream/
endStream/listQueue/addQueueItem/reorderQueueItems/featureQueueItem) and `api/sales.ts`
(switchSaleMode). `tsc --noEmit` clean throughout.

Scheduling a _future_ show (`CreateShow.tsx`, the old 6-step wizard) stays untouched and still
fully mock — the backend has no scheduling flow, only immediate go-live, so there was nothing real
to wire it to. Not a gap in this phase, a real absence in what's been built.

**Verified against real production**, full real round trip, twice: go live → a real AWS IVS channel
is created (`CreateChannelCommand`, confirmed by the real ingest endpoint shown on screen) → added
a real product to the queue → featured it (AUCTION, $10 start) → the panel showed the real open
sale and its current amount. Caught the backend auto-cancelling that sale on its own short default
duration mid-test (no `durationSeconds` was passed) — confirmed the realtime wiring here is live
too: the panel picked up `sale.cancelled` and disabled "Switch mode" on its own, no reload needed.
Also exercised and confirmed the mode-switch form's AUCTION/BUY_NOW field toggle, and `endShow`'s
new graceful handling of an already-ended session (see bug below).

**Two things found while verifying, not fixed here (backend-side, out of this phase's scope):**

- `POST /streams/:id/queue/:itemId/feature` throws a bare `INTERNAL_ERROR` instead of a clean
  `OUT_OF_STOCK` domain error when the product has no available stock — confirmed by testing the
  exact same flow against an exhausted product (hit the 500) and a fresh one (worked cleanly).
  Product `01M4VF0BEH2MFBJB342MT4KTCJ` ("Queue Test Product") is left at 0 available in production
  from repeated Phase E/F test sessions that never released their reservations — harmless (it's a
  test fixture), but don't reuse it expecting stock; a fresh product via `POST /products` works.
- No `durationSeconds` control was added to the feature/switch forms — both always use the
  backend's own default, which is short enough that a featured item with zero bids can auto-cancel
  within well under a minute (confirmed live, see above). Real sellers probably want to set this;
  flagged rather than guessed at a UI for it.

**One frontend robustness fix made after hitting it live**: `endShow` used to show a raw
`INVALID_STREAM_STATUS` error (generic "Something went wrong") and leave the seller stuck on a
dead session if `stream-reconcile.processor.ts` had already ended it first. Now treats that one
error code as success and clears local state anyway, since the seller's actual intent ("stop
managing this show") is already true either way.

## Phase E, done (14 Oct 2026)

`Live.tsx` is real now: `GET /streams/live` drives the swipeable feed (no more mock `streams.ts`/
`live-reels.ts`, both deleted along with the mock auction reducer `auction.ts`/`useAuction.ts`/
`constants/auction.ts`/`types/auction.ts` and the orphaned `data/auctions.ts` it exposed). Each
reel is its own `LiveReel` component (`components/live/LiveReel.tsx`) owning a new `useLiveReel`
hook (`hooks/useLiveReel.ts`) that only runs — HLS token fetch, room join, WS subscriptions — while
that reel is the one on screen; off-screen reels cost nothing. Real HLS playback via
`expo-video`/`ReelVideo` (now takes a playback URL string, not a bundled clip). Bidding reuses the
exact same HTTP calls + `realtime/sale-events.ts` appliers `SaleActions.tsx` already uses — no new
bidding logic invented. Bid-feedback UI (`components/live/BidFeedback.tsx`): a single leader line
("X is leading" / "You're leading"), a quiet one-line outbid/now-featuring notice (auto-clears,
never a banner), and a win moment with an `InitialsAvatar` (no avatar field exists anywhere in the
schema) — a centered moment for an AUCTION win, a smaller lower-anchored row for a BUY_NOW purchase,
deliberately distinct per the founder's instruction. Discover's "Live Now" grid now reads the same
`GET /streams/live` list; the category filter was dropped there (a `StreamSession` carries no
category of its own — flagged, not guessed at). `useNavigation`'s default stream id and the one
stray mock-id reference in `Profile.tsx`'s "Explore live shows" button were fixed to let Live.tsx
fall back to the first real live session instead of a hardcoded "s1". `tsc --noEmit` is clean.

**A real, pre-existing production bug was found and fixed along the way**: `frontend/.env` had no
`EXPO_PUBLIC_REALTIME_URL`, so `realtime-url.ts` fell back to `https://api.swishfy.com:3001` —
wrong for the deployed backend, which proxies realtime over `wss://api.swishfy.com` (no separate
port exposed; confirmed against `appConfig.publicRealtimeUrl`, which is exactly what `/streams/:id/
start` and `/streams/:id/viewer-token` already return as `wsUrl`). This silently broke **every**
realtime feature — bidding, chat, notifications, viewer counts, not just this phase's work — for
anyone running the app against production without that var set. Fixed by adding
`EXPO_PUBLIC_REALTIME_URL=wss://api.swishfy.com` to `frontend/.env` (gitignored, not committed,
same as the API URL line above it). **Whoever deploys a real EAS build needs this same var set** —
flagging here since it's not yet anywhere in a committed `.env.example` (none exists for this repo).

Also added: `useLiveReel` now listens for the socket's `exception` event (a `room.join` rejected
mid-session — most likely `STREAM_NOT_LIVE` if the seller's stream ends while someone is watching —
arrives this way, not as a `room.state` reply) and surfaces the message instead of leaving the
product panel silently on "Nothing featured yet." forever.

### Phase E verification — what was and wasn't possible in this environment

No real OBS/RTMP source is available here, so full end-to-end verification (real video playing,
placing a real bid, seeing the win moment) could not be done. What **was** verified against real
production (`stream-test-seller@example.com`, product `Queue Test Product`, several real IVS
channels created and torn down via direct API calls, all cleaned up — nothing left running):

- Empty states (no one live) on both `Live.tsx` and Discover — real, correct, dark-themed (an
  earlier version of the empty state used a light background that broke the tab bar's icon
  contrast against the dark Live-tab shell; fixed to match).
- A real session's header renders with real channel data (name, banner) and a real follow button.
- The realtime socket actually connects and joins the room — confirmed via a real viewer-count
  increment (0 → 1) once the `EXPO_PUBLIC_REALTIME_URL` fix was in — this is the part that was
  silently broken before.
- The video element fails gracefully (a `NotSupportedError` console exception, no crash, no blank
  white screen) when there's no real video data, which is expected for a channel with no publisher.
- Every attempt to get far enough to see a real featured item + sale raced
  `stream-reconcile.processor.ts`, which auto-ends a session with no real RTMP data arriving within
  roughly 20-60 seconds (working as designed, confirmed in the Phase A-D pass too) — faster than a
  manual curl-then-reload cycle could reliably win. One `POST .../queue/:id/feature` call also hit
  a bare `INTERNAL_ERROR` rather than a clean domain error; not investigated further (likely a
  pre-existing stock-reservation edge case from the repeated test sales this left behind, unrelated
  to Phase E's own code, backend-side). **Whoever does Phase F (which needs a real seller actually
  broadcasting to test go-live) should expect this same reconcile-timing constraint** and either
  use real OBS or budget for it.

## Decisions already made — do not re-ask

1. **Video provider**: Amazon IVS Classic (not LiveKit, not IVS Real-Time/Stages). Both LiveKit and
   IVS adapters exist behind `StreamProviderPort`; `STREAM_PROVIDER=ivs` env var selects IVS. A
   rollback to LiveKit is a one-line env change, not a code change.
2. **Mode switch** (founder_requests.md §1): switching an open sale between AUCTION and BUY_NOW
   **keeps the same Sale row and its existing bids** — it's an update, not cancel-and-recreate.
3. **Queue additions** (founder_requests.md §2): sellers **can** add a new item to a live stream's
   queue mid-stream, not just reorder what was planned at setup.
4. **Featuring a new item does NOT auto-cancel the previous item's sale.** A deliberately
   conservative default (see `FeatureQueueItemUseCase`'s own comment) — the founder never asked for
   an auto-cancel side effect, and money-adjacent behavior doesn't get invented silently. If this
   needs to change, it's a product decision to ask for, not infer.
5. **Broadcast path for v1**: sellers broadcast via OBS (or any RTMP-capable tool) using the ingest
   URL + stream key the app gives them — not a native in-app camera broadcast. That needs a
   custom EAS build (native RTMP module), which doesn't exist yet and is explicitly out of this
   arc's scope. This is a real, intentional v1 simplification, not a shortcut taken silently.

## What Phase E (next session starts here) actually involves

`frontend/src/Live.tsx` is the home-feed "reels" live-viewing screen. **Before this work, it was
100% local mock state** — not just fake video, but fake auction/bidding/chat too (a `useAuction`
local reducer, canned comments, "Mock auction · No payment will be taken" labels, a debug panel to
"simulate competing bid"). The backend WS events it needs to consume instead are now real and
verified live (see below) — this phase is about actually wiring the screen to them, plus building
the UI the founder specifically described:

- **Video**: real HLS playback via `expo-video` (already a dependency, already supports HLS,
  nothing new to install) — pointed at the `playbackUrl` from `POST /streams/:id/viewer-token`.
- **Current-item banner** (founder_requests.md §3): `room.state`'s `currentItem` field (on
  `room.join`) plus the `queue.item-featured` WS event (when the seller switches items live) is
  everything needed to drive this.
- **Bid feedback UI** (founder_requests.md §5 — **needs a real design pass, not just wiring**,
  the founder was specific that this should NOT look like a banner and NOT look like a
  whatnot-style flashy animation):
  - `bid.outbid` WS event → "you've been outbid" indicator to the previous leader
  - `sale.updated`'s `leaderName` field (now a real resolved display name, not a raw id) → single
    current-leader indicator, not a scrolling feed of every bid
  - `sale.resolved`'s `winnerName` → the win moment: centered username + text. **No avatar/profile
    picture exists anywhere in this schema** (confirmed, not assumed — avatar upload is out of
    scope, same as seller documents) — render an initials placeholder, never a fabricated photo.
  - `sale.mode-switched` WS event → update the UI if a seller flips a featured item's mode live
  - A separate, distinct "so-and-so just bought this" feed row for BUY_NOW purchases, kept visually
    separate from the auction win moment (founder was explicit these are two different things)

## What Phase F involves

A seller-facing screen combining: the go-live flow (`POST /streams`, `POST /streams/:id/start`
showing the real ingest URL + stream key for OBS, `POST /streams/:id/end`), queue management
(`GET/POST /streams/:id/queue`, `PATCH /streams/:id/queue/reorder`,
`POST /streams/:id/queue/:itemId/feature`), and a mode-switch control
(`POST /sales/:id/mode`) for whatever's currently featured.

## Backend API reference (all live at `https://api.swishfy.com`, all built and verified this session)

| Method | Path                                 | Auth   | What                                                                                                           |
| ------ | ------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------- |
| POST   | `/streams`                           | seller | Create a session                                                                                               |
| POST   | `/streams/:id/start`                 | seller | Go live — returns `{sessionId, publishToken: {mode:'rtmp', ingestEndpoint, streamKey}, providerRoomId, wsUrl}` |
| POST   | `/streams/:id/end`                   | seller | End the stream                                                                                                 |
| POST   | `/streams/:id/viewer-token`          | user   | Returns `{providerRoomId, viewerToken: {mode:'hls', playbackUrl}, wsUrl}`                                      |
| GET    | `/streams/:id/queue`                 | none   | List a session's queue, ordered                                                                                |
| POST   | `/streams/:id/queue`                 | seller | Add an item (always appends; mid-stream OK)                                                                    |
| PATCH  | `/streams/:id/queue/reorder`         | seller | Reorder — body is the full new `orderedItemIds` list                                                           |
| POST   | `/streams/:id/queue/:itemId/feature` | seller | Feature it — opens/reuses its Sale, becomes the current item                                                   |
| POST   | `/sales/:id/mode`                    | seller | Switch an open sale's mode live                                                                                |

WS events (Socket.IO, `wss://api.swishfy.com`, path `/socket.io/`): `room.state` (on join, now
carries `currentItem`), `queue.item-featured`, `sale.updated` (now carries real `leaderName`),
`bid.outbid`, `sale.resolved` (now carries real `winnerName`), `sale.mode-switched`,
`sale.cancelled`, `bid.accepted`, `offer.received`/`offer.responded`.

## Verified live against real AWS, 14 Oct 2026 (not mocked, not assumed)

Full real sequence, fresh seller/product/session, deployed on EC2 with `STREAM_PROVIDER=ivs` and
real IAM credentials (`swish-ivs-backend`, `IVSFullAccess`, region `us-east-1`):

1. `POST /streams/:id/start` → real AWS `CreateChannelCommand` → real ingest endpoint
   (`*.global-contribute.live-video.net`) + real RTMP stream key
2. `POST /streams/:id/queue` → `POST .../feature` (AUCTION, $10 start) → item `ACTIVE`, a real
   `Sale` opens (`GET /sales/:id` confirmed `status: OPEN`)
3. `POST /sales/:id/mode` (→ BUY_NOW, $50) → **same sale id**, `startAmount` preserved, `price` now
   set, still `OPEN`
4. Joined the room over a real WebSocket (`socket.io-client`, real JWT) — `room.state` arrived with
   the real `currentItem` (`itemId`, `productId`, `saleId`, `mode`, `endsAt`)
5. `POST /streams/:id/end` → real `DeleteChannelCommand`, confirmed by directly querying AWS
   afterward (`GetChannelCommand` on the same ARN → `ResourceNotFoundException`)

**Incidental proof `stream-reconcile.processor.ts` works against real IVS**: a session marked LIVE
with no real video actually being pushed to the channel was correctly caught and auto-ended by the
reconcile job within about a minute — first real-world confirmation of that safety net against the
actual provider (previously only tested against LiveKit, in an earlier phase).

`tsc --noEmit` clean throughout. **All 113 pre-existing tests still pass — no regressions.**
Migration `20261013195426_stream_queue_items` applied in production.

## Other things worth knowing for whoever picks this up

- All commits for this arc are already pushed to `main` (see `prompt.md` for the exact commit log)
  and deployed live on EC2 — nothing is sitting locally uncommitted from this work.
- Don't re-litigate the IVS-vs-LiveKit or Classic-vs-Real-Time decisions — both are settled with
  reasoning recorded above and in `09-DECISIONS.md`.
- A test seller account exists in production: `stream-test-seller@example.com` /
  `StreamTest123!`, approved, with at least one test product. Fine to reuse for Phase E/F
  verification instead of creating a new one each time.
- This file itself and `founder_requests.md` are **never committed** (see the memory entry
  `feedback_no_progress_md_commits` — "show leftover work," user doesn't want that visible in the
  shared GitHub repo). Keep editing them locally as this work continues, just never `git add` them.
