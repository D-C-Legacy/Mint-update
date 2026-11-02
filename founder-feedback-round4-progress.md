# founder-feedback-round4-progress.md (local-only, never committed)

Started 26 Oct 2026. The founder sent a long, frustrated voice-memo transcript (relayed by the
user) after looking at the live web app himself for the first time in a while. Separate arc from
`live-issues-progress.md` (Phases 1-7, closed except Phase 7) and `founder-feedback-round2/3`
(both closed) — but **issue 4 below (OBS/web stream blank) is very likely the same underlying
thing as `live-issues-progress.md`'s still-open Phase 7**. Read that file's Phase 7 section before
starting issue 4's investigation — don't re-derive the reconnect-related hypothesis already written
there.

**Status header — update this every session.**
**CLOSED, 26 Oct 2026. All four fixed, committed (`e123e17`, `4de2cdc`), pushed, and deployed to
EC2.** Issue 1: subtext copy built and confirmed with the user ("Stick around, bidding starts
soon."). Issue 2: title moved above the product panel (further refined mid-session after a live demo
call — see `4de2cdc`). Issue 3: Wallet opens an in-place sheet. Issue 4: root-caused as hls.js/web
HLS decoding, not the OBS-reconnect theory — fixed, and verified live with a real OBS stream on this
session's demo call (real video played, not blank). **Not independently re-verified after deploy**:
issues 1 and 3 (empty-state subtext, Wallet sheet) — built and in the same deploy as the
confirmed-working pieces, but nobody specifically re-clicked through those two after shipping.
**Next round of founder feedback is `founder-feedback-round5-progress.md`** — arrived the same day,
after this round's fixes were demoed live, partially overlapping (title placement) and partially new
(volume control, always-visible bid button, a real-time-refresh bug, automatic queue). Also found,
not part of founder feedback: a reproducible refresh-token bug during live testing — see round5's
file for detail.

---

## The founder's actual words (trimmed to the complaints, not the venting)

- The "Auction hasn't started" text just sits there with no button, looks unfinished/broken.
- "The title thing... was always at the bottom" — reacting to the stream title now showing under
  the seller's name at the top.
- The Share/Wallet/Shop buttons: "do they work? They take you to another page instead of a pop-up
  or a drop-down."
- "Web still doesn't work... it's a blank fucking screen" — almost certainly about the live stream
  video itself (OBS), not the app chrome around it, based on the rest of the message and the
  screenshot he sent (a real, polished Whatnot-style frame with no video, "Auction hasn't started"
  floating over black).
- A process/trust complaint: feels like things get marked done without ever being demoed to him.
  Not a code issue — the fix is behavior going forward (actually show him things, don't just claim
  done), not a ticket.

## Issue 1 — "Auction hasn't started" empty state has no visual weight

**Investigated.** `frontend/src/components/live/LiveProductPanel.tsx`'s empty-sale branch (no
`product`/`sale`) was changed in commit `ad9ea8c` (24 Oct) to a single plain-text line, replacing
an earlier version that had a bold headline ("Nothing featured yet") + a muted explanatory subtext

- a dimmed, disabled "Place a bid" button. **The dimmed button was removed deliberately at the
  founder's own request on 23 Oct** ("never a dimmed, non-functional bid button sitting there with
  nothing behind it") — so this isn't a regression from nowhere, it's a side effect of something he
  asked for two days before this complaint. Worth knowing, not worth relitigating with him.

**Proposed fix, not yet built**: bring back the headline + subtext (two lines of real content
instead of one bare line), but keep the fake button gone, matching his 23 Oct request. Confirm
with the user before building — this one touches copy/tone, worth a quick sanity check on wording.

## Issue 2 — stream title crammed under the seller's name

**Fixed locally, 26 Oct 2026. Not committed, not deployed.**

- Git-archaeology'd it first: no version of the code ever showed the title at the "bottom" — it
  didn't exist in the UI at all before commit `79b5a9f` (23 Oct), which added it as a second line
  directly under the seller name inside `LiveSellerHeader.tsx`. So the founder's "it was always at
  the bottom" doesn't match any real prior state — likely conflating it with a mockup/reference
  image (he sent a Whatnot-style screenshot where the "title" is actually a graphic baked into the
  video by the seller's own OBS scene, not app-rendered text at all — flagged to him directly).
  He then confirmed: just move it off the seller-name row, not literally "to the bottom."
- New exported component `LiveStreamTitle` in `frontend/src/components/live/LiveSellerHeader.tsx`
  (bold, 18px, its own line, shadowed same as the rest of the overlay text). `LiveSellerHeader`
  itself reverted to not taking a `title` prop at all (back to its pre-23-Oct shape).
  `frontend/src/components/live/LiveReel.tsx` and `LiveReelDesktop.tsx` both render
  `<LiveStreamTitle title={session.title} />` as its own element, stacked above
  `<LiveSellerHeader>`, not passed into it.
- Typechecked clean (both runs — backend untouched, frontend `npm run typecheck`, the 8GB-heap
  script).

## Issue 3 — Wallet button navigates to a whole new page

**Fixed locally, 26 Oct 2026. Not committed, not deployed.**

- Confirmed by reading the code: Share opens the OS/browser share sheet (correct, that's supposed
  to leave the page), Shop opens an in-place `Sheet` popup (correct), but Wallet called
  `app.navigate(ROUTES.PAYMENTS)` on both mobile (`LiveReel.tsx`) and desktop
  (`LiveReelDesktop.tsx`) — a real, confirmed inconsistency, not a guess.
- **Context `live-issues-progress.md` doesn't have**: desktop web's Wallet button didn't exist at
  all until `live-issues-progress.md` Phase 6 (23 Oct) added it for parity with mobile, using the
  same `app.navigate(ROUTES.PAYMENTS)` mobile already had. So this complaint is about a pattern
  that's existed since the very first version of the button on both platforms, not something newly
  broken.
- New shared component `frontend/src/components/live/LiveWalletSheet.tsx`
  (`LiveWalletSheetContent`): shows the viewer's saved cards (reusing `listCards`/`cardLabel`/
  `cardExpiry` from `api/payments.ts`, same `useAsync` pattern `PaymentsScreen.tsx` already uses)
  plus a "Manage payment methods" button that does the actual navigation — same escape-hatch
  pattern the product sheet already uses for "View full product". Wired into both `LiveReel.tsx`
  and `LiveReelDesktop.tsx`: `onWallet` now does `setSheet('wallet')` instead of navigating
  directly, with a new `<Sheet visible={sheet === 'wallet'} title="Wallet">` block in both files.
- Typechecked clean.

## Issue 4 — web live stream shows blank / OBS not working

**NOT investigated yet.** This is next session's actual task, after the mobile screenshots (see
below). **Read `live-issues-progress.md`'s Phase 7 section first** — it already has a real,
written hypothesis tying "stream not appearing to viewers" / "can't hear himself" to Phase 1's own
root cause (AWS IVS reporting "not broadcasting" the instant OBS drops even briefly, with zero
tolerance before that fix shipped) and was explicitly left open pending the founder confirming
whether this recurred after that fix deployed. He's now reporting it again, unprompted, which is
plausibly that same confirmation arriving on its own — worth leading with that theory, not
re-investigating from zero. Also worth getting from the founder directly, if possible: is this
happening on web specifically, native app specifically, or both — his message says "web" but the
original Phase 7 report didn't specify a platform.

## Issue 5 — trust/process complaint

Not a code task. The fix is behavior for future sessions: actually demo things (screenshots/video,
not just a claim of "done"), and don't mark something finished without having exercised it for
real. This file and the mobile-screenshot-first plan for next session are a direct response to
this, not a separate ticket.

---

## Verification done this session (26 Oct 2026)

Backend `npm run typecheck`/`eslint src` and frontend `npm run typecheck` all clean for issues 2
and 3's changes. **Not yet exercised live** — the uncommitted/undeployed state means the actual
production site still shows the old behavior (confirmed: the three screenshots captured this
session, saved locally, were taken against current production, before these fixes went out).

A real demo stream was run this session (`stream-test-seller@example.com`, product "Demo Switch
Item", title "Poke Auctions") to capture real desktop-web screenshots of the three auction states
(not started / live bidding / ended) — **these were desktop/web layout, not mobile**, which is
not what's needed; the user wants the mobile layout instead. That's the very first thing to do
next session, before anything else. Show was cleanly ended and queue cleared after — no lingering
test state on production.

**One finding worth correcting**: while testing, a zero-bid auction appeared stuck at
`status: "OPEN"`/`resolvedAt: null` for 90+ seconds after its countdown hit zero, which looked like
a broken auto-resolve job (and several old test auctions from as far back as 13 days ago are still
sitting in that same state via the public API). On a second, cleaner attempt it resolved to
`EXPIRED` in under 25 seconds. So the sweep job itself isn't reliably broken — but those old
stuck records are still unexplained and worth a look sometime, low priority, not blocking anything.

---

## Pending commit, ready whenever the user wants to push it

```
git add frontend/src/components/live/LiveSellerHeader.tsx frontend/src/components/live/LiveReel.tsx frontend/src/components/live/LiveReelDesktop.tsx frontend/src/components/live/LiveWalletSheet.tsx
git commit -m "fix: live stream title moved above seller row, Wallet opens in-place instead of navigating away"
git push
```

EC2 (already SSH'd in, run directly, no ssh wrapper needed):

```
cd ~/swish
git pull
docker compose -f docker-compose.prod.yml build app-web
docker compose -f docker-compose.prod.yml up -d app-web
```

Backend untouched by this batch — only `app-web` needs rebuilding.

---

## Resume protocol

1. Read this file's status header.
2. First thing, every session until done: confirm with `git status`/`git log` whether the pending
   commit above has landed yet — don't assume from this file's prose, this repo has been burned by
   stale tracker prose before (see `prompt.md`'s own standing rule: commit wins over tracker text).
3. State what you're resuming at.
4. Work one issue at a time, stop and report, update this file before moving to the next.
