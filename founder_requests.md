# founder_requests.md: Work the founder has asked for

Captured from a WhatsApp conversation between the user (Hammas) and the founder, 9-10 Oct 2026,
with more added 12-15 Oct 2026 (see `## Status update, 15 Oct 2026` right below). **Originally
"nothing here built until the user says 'analyse whole chat properly'" — that gate has since been
overtaken by events: the user separately asked for live streaming work and web-native work, which
turned out to overlap directly with sections 1, 2, 3, 5, 6, and 8 here. All six are now fully done**,
verified live (see status note below each) **— the "wait for the phrase" rule still applies to
section 4 and the rest of the untouched backlog**, not to those six. **Section 7 (scheduled-stream
display) is the next open question in this file** — no concrete spec exists, needs a real founder
decision before building (see that section). The actual next engineering task overall is S3 storage,
which isn't in this file at all — see `../prompt.md` §9.

Quotes below are the founder's own words, kept so nuance isn't lost. Anything marked **OPEN** is
a real ambiguity in the chat, not something to guess.

## Status update, 15 Oct 2026 — read this first

Live-streaming work turned out to BE sections 1, 2, and 3 below, plus section 5's backend half.
Separately, the founder's first real UX pass on the web version turned out to BE sections 6 and 8.
**All of sections 1, 2, 3, 5, 6, and 8 are now fully DONE, backend and frontend both**, verified
against real production. Full detail: `streaming_progress.md` for 1/2/3/5, `web-design-progress.md`
for 6, both local-only. **Section 7 (scheduled-stream display, no AI thumbnails) is the only open
item left in this file** — founder said "we'll show that another way" without saying what way;
needs a real decision, not a guess, before building. Section 4 (customer profile) and the
conversation log still wait for "analyse whole chat properly."

**16 Oct 2026 — S3 storage shipped and verified live, and the founder's first real OBS broadcast
attempt surfaced two real bugs (bad ingest URL format, an over-eager session auto-end) — both found
and fixed the same day.** His next real-use pass (actually watching his own test stream on
swishfy.com) surfaced four more real issues, quoted in full and fully diagnosed in `prompt.md` §14:
live chat is entirely fake (hardcoded seed data, never wired to the real backend chat system, on
both the app and web), the bid/buy panel disappears instead of staying visible with nothing
featured, the desktop web Share button was never built, and refreshing the Discover page on web
drops back to Home. **This arc is now DONE and deployed live** (handed to OpenCode, tracked in
`live-features-progress.md`) — real typecheck/lint problems in OpenCode's diff were caught and fixed
before deploy, and the deploy itself was verified (API boot watched directly for the one real
runtime risk, a first-time `forwardRef` circular-dependency fix).

**Same day, two more real asks surfaced** (quoted in full in `prompt.md` §15): a real "Make an Offer"
entry point on the live stream (a Snapchat-live screenshot was the reference — "make an offer"/
"checkout" options via a "more" button) with sellers able to view and respond to offers in their
seller portal, and separating the Inbox's "Activity" tab into its own proper nav entry with a
dedicated screen (mark-all-read, delete). Confirmed by reading the actual code: offers are a mature,
complete backend feature already (`submit-offer`/`respond-to-offer` use cases, a real buyer-side UI
on the product page) — the live-stream entry point and the seller-side response screen are the real
gaps, not the whole feature. This is the current task — handed to OpenCode, tracked in
`offers-and-activity-progress.md`.

**UPDATE 17 Oct 2026 (OpenCode session):** Phase 1 (the live "Make an Offer", OFFER as a real
third sale mode) is **code-complete on both native and web viewer panels**. Phase 2's backend
(`GET /seller/offers`, defaulting to PENDING + a `SellerOfferView` carrying product/buyer data)
**and** its frontend (the seller Offers screen: Pending/History chips, entry-refresh + Refresh
button, real Accept/Reject/Counter wired to `POST /offers/:id/respond`) are **code-complete too** —
but everything is still untypechecked, unverified live, and uncommitted as of this update, so
none of it is shipped to swishfy.com yet. Phase 3's open placement question was answered by the
user the same day: mobile gets a 6th "Activity" tab, the desktop web navbar gets the bell split
out from the chatbubble (both badges split with it); the build itself is next. Phase 4's
delete-semantics decision is still open.

---

## 1. Per-item sale mode in a live stream: auction OR buy-now, switchable live

**STATUS 14 Oct 2026: DONE, backend and frontend both, verified live.** `POST /sales/:id/mode`
switches an open sale's mode without losing it or its bids (the OPEN question below is resolved:
keep the sale). The seller's own switch control is built in `ControlRoom.tsx` (Phase F) — it
defaults to Auction right now, which section 8 below says is backwards; that's the next fix.

**What the founder wants.** Not every item on a stream should be an auction. While a seller is
presenting an item, it should be possible for it to be a straight **buy option** instead:
"if I'm presenting something on the stream at that moment, then a buy option should happen."
The stream's action button "shouldn't just be a bidding button", it should be able to change and
**swap on the fly** for single-purchase items, **in real time during the stream and also from the
back end** (seller tools).

- Show **how many are in stock** on the item (founder's examples: 5, 10, 20 of a limited-edition
  collectible).
- Reference point: QVC. An item is shown on screen, the viewer likes it, swipes in and buys it.
  "I shouldn't have to auction for everything."
- Hammas's restatement (founder did not contradict it): switching on the fly from an auction state
  to a marketplace-style "showcase it and anyone who wants it can get it" state.
- **Explicitly NOT asked for:** casino/slot/"pay for a slot" or chance-based mechanics. The
  founder mentioned Whatnot does these and says they are tired of it, especially in collectibles.
  Do not add anything like that.

**Verify against code when analysing (not checked in depth yet):**

- `SaleMode` already has `AUCTION`, `BUY_NOW`, `OFFER`, and `Sale` already has `price` and
  `quantity` for buy-now (`prisma/schema/sales.prisma`). So buy-now as a mode exists.
- What looks missing: switching a sale's mode **while it is live**. Mode is set at creation, and no
  route for changing it was seen. Confirm. This is the real new work.
- Stock display: `Product.quantity`/`reserved` exist. Whether the live stream payloads expose
  remaining stock to viewers is unchecked.
- The mobile app's live screen only has the bid flow wired today (see `prompt.md` §5c). Buy-now
  exists in the app for browse/product pages but not as an in-stream button swap.

**RESOLVED 14 Oct 2026** (was OPEN): when a seller switches an item mid-sale from auction to
buy-now, what happens to bids already placed? **Answer: the sale and its bids stay — switching
just changes the mode going forward**, not a cancel-and-restart. Built this way.

---

## 2. Product queue for a stream (the "inventory order")

**STATUS 14 Oct 2026: DONE, backend and frontend both, verified live.** Add (mid-stream inserts
allowed, see RESOLVED note below), reorder, and feature (which opens the real sale) all work — see
`streaming_progress.md` for the API reference. The seller's queue management screen is built in
`ControlRoom.tsx` (Phase F) and verified end to end against real production.

**What the founder wants.** A **product queue** per stream: an ordered list of the products the
seller will show, so the seller (and the system) knows what comes up next.

- Seller can see **the next item** that will come up.
- Seller can **reorder the queue on the fly**, e.g. pull a hot, bigger-ticket item forward because
  "this is the one I want to focus on". Founder: "You need dynamic systems to create a more
  compelling experience."
- Items go in the order set up in advance by default, but the seller isn't forced to follow it.
- Each queued item can be set as **auction or purchase** (ties to section 1), and that can be
  changed on the fly too.
- Founder also mentioned **last-minute additions** to the stream (a product not in the original
  queue).

**Where Hammas and the founder landed.** Hammas worried that per-item live setup would be
**tedious for sellers** and proposed setting it only at stream setup (choose how many products to
showcase). The founder replied there are real moments where you want to change flow or pacing, and
a fixed list doesn't allow it. Hammas then clarified his understanding as: changing the _info_ on
selected products (price, or state auction vs for-sale), not adding or removing stock; and then
that the founder's actual ask for the queue is "just the order", and said "that's easy, noted".

**So the working reading is:** queue is configured at stream setup (low effort, which answers the
tedium concern), and the seller can **reorder it live**. Plus editing price and auction/buy-now
state on the fly (section 1).

**RESOLVED 14 Oct 2026** (was OPEN): are last-minute additions (adding a product to the queue
mid-stream) in scope? **Answer: yes.** Asked directly, founder confirmed. `AddQueueItemUseCase`
always appends and can be called anytime a session exists, not just before it starts.

**Verify against code when analysing:** no queue/ordering model exists in the schema or docs that
was seen (`Sale` is per-product-per-session with no position field). Likely a new concept, so check
`03-DATA-MODEL.md` and `05-API-SPEC.md` first, per the project's rule not to invent fields.

---

## 3. In-stream "current item" display for viewers

**STATUS 14 Oct 2026: DONE, backend and frontend both, verified live.** `room.state` (on joining a
stream's WS room) now carries the real current item + its live sale data; `queue.item-featured`
broadcasts it live when the seller switches. The viewer-side live screen (`Live.tsx`, Phase E)
reflects this in real time now.

**What the founder wants.** Viewers must always be told clearly what is happening right now:
"how are we informing the customer... here's the item you're purchasing, here's the item that is
currently up for purchase or auction." Concretely: a banner/overlay at the **bottom of the stream**
showing the current item, what the viewer is buying, and whether it's an auction or a direct
purchase. When the seller pulls a different item forward, the stream UI updates to it.

This is the viewer-side half of sections 1 and 2: without it, a live mode switch or queue reorder
has nothing to show.

**Verify:** how the mobile live screen currently shows the active item (`frontend/src/Live.tsx`,
`LiveProductPanel.tsx`) and what the realtime payloads carry (`06-REALTIME-AND-CONCURRENCY.md`).
The current live screen runs on mock data (see `prompt.md` §5c).

---

## 4. Customer profile / "customer studio" (brainstorm only, blocked)

Hammas asked what a customer's studio/profile should hold. The founder said the customer shopping
experience was already discussed at length, and that they **can't specify more without a testable
product**: "there are things I can't think of without feeling something." They also said Hammas
should **brainstorm customer functionality along the way**. Hammas's reply: get a testable product
done as fast as possible, then improve.

**Takeaways, not tasks yet:**

- No concrete customer-profile requirements exist. Do not invent a spec.
- The founder's feedback will come from using a testable build, so getting a **testable product**
  in front of them is itself the priority this chat sets.
- Whenever "analyse whole chat" is run, proposing a customer-profile feature list is allowed as a
  _brainstorm for the founder to react to_, clearly labelled as a proposal, not as a requirement.
- This is separate from the seller-facing "studio" portal, which `prompt.md` §7 says is
  conceptual only.

---

## Dependencies and cautions (from existing project docs)

- The mobile app's home/live feed is **blocked** on decision **D-005** (video provider) and on the
  streaming create/start/end routes not existing (`prompt.md` §9). Sections 1 to 3 all live inside
  a stream, so they inherit that block for the real thing. Backend pieces (mode switching, queue)
  can be designed and built independently of the video provider.
- `AGENTS.md` §4 architecture rules still bind: publish realtime events after commit, money as
  `BigInt` minor units, domain layer pure. Live mode switching touches the sale state machine and
  the bid concurrency path (`06-REALTIME-AND-CONCURRENCY.md`), so it is high-risk, not a UI tweak.
- Admin portal impact: if a queue or mode switch lands, admin moderation of streams (Phase 4 of the
  admin portal) may need to show it. Not required by the founder, just worth a thought.

## Suggested order when this is picked up — UPDATED 14 Oct 2026, steps 1-4 done

1. ~~Resolve the OPEN questions above with the founder~~ **DONE** (both resolved 14 Oct 2026, see
   sections 1 and 2 above).
2. ~~Backend: live mode switch for an open sale~~ **DONE**, verified live.
3. ~~Backend: product queue~~ **DONE**, verified live.
4. ~~Realtime events + the current-item data~~ **DONE** (`room.state` enrichment, verified live).
5. ~~Seller-side controls (stream manager) to drive all of it~~ **DONE** (`ControlRoom.tsx`, Phase F,
   verified live). **Next: make Buy Now the default there (section 8), not Auction.**

---

## 5. Live bid/auction feedback UI

**STATUS 14 Oct 2026: DONE, backend and frontend both, verified live.** The WS events this needs
(`bid.outbid`, `sale.updated` with a real `leaderName`, `sale.resolved` with a real `winnerName`)
are all genuinely implemented and verified live — `leaderName`/`winnerName` specifically were a
real gap (raw user ids were being sent) fixed as part of this pass. The frontend design pass is
done too (`components/live/BidFeedback.tsx`): a single leader line, a quiet outbid/featured notice
that auto-clears, and a win moment with an initials placeholder (no avatar field exists anywhere in
the schema) that's visually distinct from a buy-now purchase row — not a banner, not a flashy
animation, per the founder's own notes below.

**What the founder wants**, from a long voice-style message plus back-and-forth with Hammas:

- When someone is outbid, they should see a clear "you've been outbid" indicator.
- Show **one current leader at a time** — who's winning right now and for how much — not a
  scrolling feed of every single bid. Founder explicitly rejected a "giant feed of everybody
  bidding."
- When an auction **ends**, show a clear win moment: the winner's **username and profile picture,
  text, centered on screen**. Founder explicitly said **not** a banner (Hammas's first idea) and
  **not** a whatnot-style flashy animation — something simpler and clearer, but still "a bit
  bigger" than the outbid/leading indicators.
- For **buy-now purchases** (not auctions), show a separate, different feed: "this person bought,
  this person bought" — kept distinct from the auction-winner moment.
- Clarified during the back-and-forth: the **top-right price** is the current bid price, it updates
  as bids come in. The **number inside the bid button** is a _different_ number, the suggested next
  bid (current price plus an increment, e.g. +$1/+$2/+$5) — the two numbers are not the same thing
  and both were being conflated earlier in the conversation.

**Verify against code when picked up:** current bidding is real and live (Phase 5 of
`integration_progress.md`), but none of these specific UI pieces (outbid toast, single-leader
indicator, win-moment overlay, purchase activity feed) exist yet — confirm against
`frontend/src/screens` live/product-sale related files before scoping.

**OPEN:** exact copy/wording for each state, exact visual treatment for the win moment ("a bit
bigger" is not a spec) — needs a design pass, not just backend wiring.

---

## 6. Web frontend needs to feel web-native (captured 14 Oct 2026)

**STATUS 15 Oct 2026: DONE and deployed live.** Full write-up in `web-design-progress.md`
(local-only) — top navbar, split Live view, grids, 2-column product/seller-studio pages, single-page
sign-in, all web-only via the `.web.tsx` pattern described below, native app unchanged. Two more
rounds of founder feedback after the first deploy (navbar not reaching the edge, Seller studio
wanting a 2-column split) are also resolved — see that file for the full history. Still open: which
other narrow-column screens (Profile is the obvious next one) get the same 2-column treatment —
founder's call, ask before guessing.

Founder, after trying the web version for the first time: the web app currently just looks like the
phone layout stretched into a browser, and it "needs to feel more web native." Confirmed separately
that **web has full feature parity with the app**, same product, same functionality — this is purely
a presentation/UX difference, not a scope difference. The web version's stated purpose (his words):
let people see and try the real product before the app is live on the App Store, since he doesn't
want to just hand out TestFlight invites as the way to demo it.

**How to build this without risking the phone app** (already explained to Hammas, repeating here
for continuity): Expo/React Native supports per-platform component files, e.g. `ProductCard.web.tsx`
next to `ProductCard.tsx` — Metro picks the right one per build target automatically, so web-specific
layout work never touches what ships to iOS/Android.

**OPEN:** no concrete web design spec exists yet beyond "looks odd on PC right now" and "web-native."
Needs a real design pass before implementation, same caution as section 1 above.

---

## 7. No AI-generated thumbnails, ever (captured 14 Oct 2026, set aside)

Founder was explicit and unprompted about this: streams must show **their real content**, not
AI-generated thumbnails — called it "AI garbage," says it reads as ugly and a bad customer
experience, specifically contrasted against Whatnot's approach. Already true today for live content
(the Discover feed shows real looping video clips, not generated thumbnails), **but scheduled
streams** (not live yet) don't have a defined visual treatment — founder said "I think we'll visually
show that in another way," without specifying what that way is.

**OPEN:** what a scheduled/upcoming stream should actually look like on Discover, given thumbnails
are explicitly ruled out. Needs a decision, not a guess, when this is picked up.

---

## 8. Default sale type: Buy Now, not auction (captured 14 Oct 2026)

**STATUS 14 Oct 2026: DONE and deployed live.** `ControlRoom.tsx`'s add-to-queue/feature/switch-mode
pickers all default to Buy Now now; `ModeToggle` lists Buy Now first (the prominent position).
Auction is still fully available, just never pre-selected.

Founder's concern: he doesn't want auctions to feel like the default or standard way to shop
("I don't want the auction thing to feel like the default"), partly UX, partly a real worry about
reading as a gambling mechanic and creating app-store/legal obstacles. His own words: default should
be "you click, you swipe over, and you buy," possibly with a confirmation step.

**Decision for when this is built:** Buy Now is the default sale type; Auction is something a seller
must actively opt into per item, never pre-selected. Wherever both could appear in the UI, Buy Now
gets the prominent treatment, bidding stays secondary.

**Why nothing is built yet:** the actual seller flow for choosing a sale's type happens when an item
goes live in a stream (per `prompt.md` §6a Phase 7, product CRUD is deliberately catalog-only, no
price or listing-type picker, "pricing happens when the item goes into a live show"). That flow now
exists — `ControlRoom.tsx` (streaming Phase F, 14 Oct 2026) — but was built before this decision was
re-surfaced, and defaults every mode picker (add to queue, feature, switch mode) to Auction, the
opposite of what's decided here. **This is the next task, confirmed with the user 14 Oct 2026.**

---

## Conversation log (what was said, in order)

- 9 Oct 2026, ~9:03 pm: founder says to brainstorm customer functionality along the way. Hammas
  asks what a customer studio/profile should hold. Founder: already discussed at length.
- Later same night: Hammas asks the founder to elaborate on the desired customer experience.
  Founder: can't without a testable product. Hammas: will finish quickly, then improve.
- Founder's long voice-style message: auction vs buy option, stock count, QVC, no casino
  mechanics, swap on the fly in-stream and from the back end. Hammas restates it as auction to
  marketplace-style state switching.
- Founder: inventory order/queue, reorder on the fly, per-item auction or purchase setting.
- 9 Oct, 11:53 pm: Hammas questions on-the-fly queue editing as tedious, suggests setup only.
  Founder explains why live changes matter, asks how the stream tells the customer what's up.
- 10 Oct, ~12:03-12:06 am: Hammas clarifies scope as editing price/state, not stock. Founder:
  "Product Queue: the ability to change the order of products that's visually presented to the
  users, featured at the bottom." Hammas: "just the order, that's easy, noted."
- 12-14 Oct 2026 (captured from `convo.txt`): founder's long voice message on auction-winner and
  bid-leader UI (sections 5 above), clears up the bid-button-number vs top-right-price confusion
  mid-thread. Separately, raises the web frontend needing to feel more web-native (section 6) and
  reiterates no AI thumbnails ever (section 7). Hammas asks whether web has full app functionality
  or is marketing/waitlist-only; founder confirms full parity, web is meant to let people try the
  real product before an App Store launch. Founder also asks how buy vs auction defaults are being
  handled, explicitly wants Buy Now as the default to avoid an auction-first, gambling-adjacent feel
  (section 8). **User (Hammas) then said: move to live-streaming work first, set sections 5-8
  aside for now** — captured here, not started.
