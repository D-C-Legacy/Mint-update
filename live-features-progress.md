# live-features-progress.md: real chat, always-visible bid/buy panel, Share button, Discover-refresh bug (local-only, never committed)

Started 16 Oct 2026. See `prompt.md` §14 for the full handoff context (founder's own words, confirmed
findings, file pointers, ground rules) — this file is the phase-by-phase status tracker, same
discipline as `deploy_progress.md`/`admin_progress.md`/`design_progress.md`.

**Working in small sub-phases — stop after each one, report what changed, wait for "continue" before
starting the next.** The user runs every git command themselves.

## Sub-phase table

| Sub-phase | What                                                                                                                                      | Status          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1a        | Live chat — backend: display-name resolution at send time, recent-message snapshot carries the name, `room.state` carries recent messages | **DONE (code)** |
| 1b        | Live chat — native chat sheet wired to real send; dummy "Questions" tab + "Preview only" note removed                                     | **DONE (code)** |
| 1c        | Live chat — desktop `LiveReelDesktop.tsx` wired to real send; dummy `data/chat.ts` deleted                                                | **DONE (code)** |
| 1d        | Live chat — `CHAT_USER_BANNED` error text, this tracker updated                                                                           | **DONE (code)** |
| 2a        | Always-visible bid/buy panel — native (`LiveProductPanel` placeholder state)                                                              | **DONE (code)** |
| 2b        | Always-visible bid/buy panel — desktop (`LiveReelDesktop.tsx`)                                                                            | **DONE (code)** |
| 2c        | Panel tracker update + typecheck handoff                                                                                                  | **DONE (code)** |
| 3a        | Desktop Share button (`LiveReelDesktop.tsx`) + native share made real                                                                     | **DONE (code)** |
| 3b        | Share tracker update + typecheck handoff                                                                                                  | **DONE (code)** |
| 4a        | Discover-refresh routing — trace web nav state, push/read browser URL                                                                     | **DONE (code)** |
| 4b        | Routing tracker update + typecheck handoff                                                                                                | **DONE (code)** |

## Decisions made (flag here, don't guess silently)

- **Chat history delivery mechanism — RESOLVED.** §14 recommended extending `room.state` with recent
  messages rather than a new REST endpoint. Doing that creates a `ChatModule ↔ StreamingModule`
  circular import (chat needs "is this session live"; streaming needs chat history for `room.state`),
  broken with NestJS `forwardRef` on both sides (`chat.module.ts` / `streaming.module.ts` +
  `@Inject(forwardRef(...))` in `SendMessageUseCase` / `StreamingGateway`). **This is the first
  `forwardRef` use in this repo** — if the API fails to boot on deploy, check this first.
- **Display names are resolved at send time, not per joiner.** `SendMessageUseCase` looks up the
  sender's display name once (mirroring `SalesGateway.resolveDisplayName`), stores it in the Redis
  recent-message snapshot, and the gateway puts it on the `chat.message` payload. `ChatMessage` itself
  is unchanged (still userId-only in Postgres) — the name is carried alongside, not persisted as a new
  column. Older cached entries without the field fall back to the userId.
- **Removed the dummy "Questions" tab** in the native chat sheet (the second fake chat the founder
  flagged: "there are two dummy chats in the live chat"). No backend exists for Q&A, so it was deleted
  rather than faked.

## Sub-phase write-ups

### 4a — Discover-refresh routing (DONE, code)

The web app's current screen was pure React state with no URL, so a hard refresh always booted to
the default tab (Home) — the founder's "refreshing on discover takes you back to home".

- `hooks/useNavigationBase.ts` (new): the existing hook body, renamed so the web variant can import
  it without a self-import.
- `hooks/useNavigation.ts`: now a one-line re-export of the base (native path unchanged).
- `hooks/useNavigation.web.ts` (new): same state/API plus URL sync — restores the tab + top route
  from `window.location.pathname` on load, and `history.replaceState`s the URL on every navigation.
  Scheme: `/` (Home), `/discover`, `/sell`, `/inbox`, `/profile`, `/<tab>/<route>/<id>`.
- Native untouched (the `.web.ts` file never ships to the app).

Flagged, not fixed: browser back/forward isn't wired (`replaceState`, not `pushState`); the selected
live session (`stream`) and route `amount` aren't encoded in the URL.

### 3a — Share (DONE, code)

- New `frontend/src/lib/share.ts` (native: react-native `Share`) and `share.web.ts` (web: Web Share
  API, clipboard fallback) — a shared `shareStream({ title, url })`, split by Metro as usual.
- `constants/app.ts`: added `APP_WEB_URL = 'https://swishfy.com'`.
- `LiveReelDesktop.tsx`: a Share pill overlaid bottom-right on the video (icon + label).
- `LiveReel.tsx`: the native rail's Share now calls the real helper.
- **Correction to prompt.md §14.3:** it said the native share was a "real share sheet". It was not —
  the native sheet was `shopaflo.demo/show/...` with a "Copy demo link (simulated)" button. Both
  platforms are now real. Flagged because §14's claim was wrong.
- Flagged: the shared URL is the app URL, not a per-stream deep link (needs Phase 4's web routing).

### 2a/2b — Always-visible bid/buy panel (DONE, code)

The founder's direction (prompt.md §14.2): the panel must be present on every stream, not vanish when
nothing is featured — "presumably in a disabled/placeholder state".

- `LiveProductPanel.tsx`: `product`/`sale` are now nullable; with neither present it renders
  "Nothing featured yet / The seller hasn't put an item up for sale yet." plus a dimmed,
  non-interactive "Place a bid" pill. The real-sale path is unchanged.
- `LiveReel.tsx`: the panel renders unconditionally; `live.loadError` (stream ended, load failure)
  still surfaces as its own line below it.
- `LiveReelDesktop.tsx`: the desktop split view has its own inline product block (it does not use
  `LiveProductPanel`), so it got the same treatment — placeholder text plus a muted "Place a bid"
  pill (`styles.placeholderBtn`), with `live.loadError` shown separately.
- Judgment call, flagged: a disabled-looking placeholder button rather than hiding the control. The
  copy ("Nothing featured yet") is a placeholder choice, easy to change.

### 1a — Live chat backend (DONE, code)

- `send-message.usecase.ts`: injects `IdentityService`, resolves `displayName` (fallback to userId),
  passes it to the cache, returns it on the result.
- `chat-cache.service.ts`: `ChatMessageSnapshot` gains `displayName`; `pushRecentMessage` takes it;
  `getRecentMessages` coerces a missing field to the userId.
- `chat.service.ts`: new `getRecentMessages(sessionId)` facade method.
- `chat.gateway.ts`: `chat.message` payload now `{ message: { ...ChatMessage, displayName } }`.
- `streaming.gateway.ts`: `room.state` now includes `recentMessages` (read via `ChatService`, not the
  chat infra cache directly).
- `chat.module.ts` / `streaming.module.ts`: `forwardRef` to break the cycle; `IdentityModule` imported
  into `ChatModule`.

### 1b — Native chat (DONE, code)

`LiveReel.tsx`: chat sheet renders real `chat.messages`; send calls `chat.send`; dummy "Questions" tab
and "Preview only" note removed; unused `Chips` import dropped.

### 1c — Desktop chat (DONE, code)

`LiveReelDesktop.tsx`: same shared `useLiveChat` hook; real list (name + body, keyed by id), empty
state, auto-scroll on `chat.messages`, `sendChat` → `chat.send`. Deleted `frontend/src/data/chat.ts`
(the dummy seed file).

### 1d — Chat error text (DONE, code)

`describe-error.ts`: added `CHAT_USER_BANNED`.

## What's NOT yet verified

Phase 1 is code-complete but **not typechecked or verified live** — the user runs those. Live
verification needs a real LIVE session (the chat send path refuses a non-live session), so it requires
either a real OBS broadcast or ffmpeg standing in (see `streaming_progress.md`), plus the backend
deployed. Do not call Phase 1 DONE until the user confirms a real message round-trips.

## Remaining sub-phases (not started)

_None — all four items (1a-1d, 2a-2c, 3a-3b, 4a-4b) are code-complete. Nothing is committed or
deployed yet, and nothing is verified live — the user runs the typecheck, commits, and deploys._

## Follow-ups flagged (not part of this arc)

- Browser back/forward button navigation (the URL sync uses `replaceState`).
- Per-stream deep link in the shared URL (needs the `stream` id encoded) — would make the Share
  button's link actually open that stream.
- Live verification of all four items needs a real LIVE session (OBS or ffmpeg) plus a deploy.
