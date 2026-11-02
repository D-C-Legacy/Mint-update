# design_progress.md: UI/UX tracker (shopaflo app)

Tracks visual design and screen flow. Backend and integration status lives in `frontend/PROGRESS.md`.
The design system itself is written up in `design.md` — read that first before touching any screen.

**Status as of 12 Oct 2026: design work is PAUSED** (all planned phases 0-7 and the Discover corrections are done; Phase 8, the home feed, is blocked on streaming). The active mobile-app task is backend wiring, tracked in `integration_progress.md`; it must not change the visual design. One open founder call from this file is still unanswered: the dead `Orders.tsx`/`OrderDetail.tsx` screens. The other one, the auth footer "Demo experience... No account, email, or payment is processed", was **resolved 12 Oct 2026 by the user: removed, not reworded** (integration Step 0; the footer and the other false demo wording are gone, see `integration_progress.md`). Screens changed by integration Phase 1 (Edit profile, Change password, Forgot password, Security) kept the existing components and styling.

**Current focus (historical):** the live screen is the reference design. `design.md` is written from it.
Rolling that language out to the rest of the app, screen by screen (see the phase list below).
**Skills loaded for this work:** `.claude/skills/` (design, design-system, frontend-design, ui-styling, ui-ux-pro-max, web-design-guidelines, impeccable, banner-design, tailwind-4-docs). Copied from `reddit_assignment`; SEO, brand, astro and slides were left out.

## Phase 0 — Design system foundation (DONE, 2026-10-07)

- `design.md` written from the live screen's actual code (palette, type, spacing, components,
  icon rules, the media-surface text-shadow convention, motion timing).
- **Purple removed app-wide in one change**: `theme/colors.ts`'s `brand` token
  (`#6C4DFF` → `#004FD8`, the live bid button's blue) is read by every screen through the shared
  `AppText`/`Button`/`Chips`/`Icon` components, so this one edit recoloured the whole app. A
  full-codebase audit for hardcoded hex found only one leftover purple (`Checkout.tsx`'s selected
  shipping-option tint, `#7047FF0A` → `colors.brandSoft`) and a few literal `#FFFFFF`/`#111113`
  that already equalled existing tokens (left alone). `brandSoft`/`chartSoft` re-tinted to blue to
  match. A new `colors.urgent` (`#FF1744`) token was split out of the live countdown's hardcoded
  red so it's reusable and documented, instead of a one-off literal.
- Confirmed by reading `Discover.tsx`: because it's built entirely from the shared components,
  it already inherited the new palette, Inter type and spacing with zero screen-level changes —
  this is true of every screen built the same way, which is most of them. The fast, low-risk path
  for the remaining phases is: polish the shared components in `components/ui/index.tsx` first
  (section 5 of `design.md`), then do a short per-screen pass for layout/icon-consistency issues
  that a shared-component fix can't reach.

## Phase 1 — Shared components polish (DONE, 2026-10-07)

Audited every component in `components/ui/index.tsx` plus `StreamCard` against `design.md`.
Found and fixed four real inconsistencies (not stylistic preference — each was a mismatch against
the system `design.md` already documents):
- `Button`: disabled state kept near-black text and a white icon against the grey disabled fill
  (icon nearly invisible, text read as fully enabled). Both now switch to `textSecondary`.
- `Button`: dropped the dead `"bid"` variant from the type — unused anywhere in the app, and if
  ever used would've rendered as a mis-shaped primary button (wrong radius, no pill). `design.md`
  §5 already says the real bid look stays inline in `LiveProductPanel` unless another screen needs
  it; building it out now would've been speculative.
- `IconButton` and `Chips` had no pressed-state feedback, unlike `Button`. Added the same
  `opacity: pressed ? 0.75 : 1` to both.
- `LiveBadge` hardcoded `borderRadius: 7` instead of `radii.pill` (999), so it sat next to the
  pill-shaped `SOON` badge in the same row with a mismatched corner. Now reuses `s.badge`.
- `StreamCard`: the viewer count was bare white text with no pill background; `design.md` §8 and
  the live screen's own reference (`LiveSellerHeader.tsx`) both define viewer counts as a
  translucent-dark pill (`rgba(16,16,20,0.45)`, `radii.pill`). Wrapped it to match.

**Noted, not fixed (out of this phase's touch list):**
- `StreamCard` and `ProductCard` both lack `shadows.card` elevation — true of both sibling cards
  equally, so fixing only one would make them inconsistent with each other. Do both together
  whenever a phase actually touches `ProductCard` (none of the planned phases list it explicitly —
  flag for a screen pass that renders the product grid).
- The inline "✓" verified-mark next to seller names in `StreamCard` matches the same convention
  already used in `Inbox.tsx` and `Live.tsx` — left alone, it's consistent, not a stray icon-family
  violation.

## Phase 2 — Browse (DONE, 2026-10-07)

Discover, Search, Collection all inherited Phase 1's fixes automatically, as predicted — every one
is built entirely from `Screen`/`Chips`/`SearchBar`/`AsyncProductGrid`/`MenuRow`/`EmptyState`, with
no raw colour, icon, or spacing literal of their own. No changes needed to any of the three.

**Found while looking, not fixed (not this phase's component):** traced the "stray red dot" flagged
in Phase 0's screenshot to `MainTabNavigator.tsx` line 138 (`styles.dot` at line ~205-213) — the
Inbox tab icon always renders a small `colors.live` dot (`t.name === ROUTES.INBOX && <View
style={styles.dot} />`), with no real unread-state check. It isn't actually "stray" — it's a
permanent, unconditional badge that shows on every screen's tab bar, which is why it turned up in
an unrelated screenshot. This is a data/logic bug (always-on, not wired to real unread state), not
a visual-design one, and `MainTabNavigator` isn't on any phase's touch list — flagging for whoever
owns inbox/notification wiring rather than fixing here.

## Phase 3 — Product and seller (DONE, 2026-10-07)

`FollowingList` and `MyBidsList` were already fully clean — built entirely from `MenuRow`/
`Button`/`EmptyState`/`AppText`, no raw literals. Three real fixes elsewhere:
- `ProductDetail.tsx`: the hero photo used a magic `borderRadius: 22` instead of a named radii
  token — changed to `radii.cardLarge` (20), matching the same large-photo convention used by
  `SellHub`/`ControlRoom`.
- `ProductDetail.tsx`: the "NOT FOR SALE" badge defaulted to `colors.brand` (no colour was passed),
  so a neutral, non-actionable status read in the one accent colour reserved for calls to action.
  Now passes `colors.textSecondary` when there's no open sale, leaving AUCTION/BUY NOW/OFFERS on
  the brand default.
- `SaleActions.tsx`: confirmation notices ("Bid placed", "Offer sent", "Purchase placed") were
  coloured `colors.brand`, but `design.md` §2 defines `colors.success` specifically for
  confirmations — changed all four notice colours to `success`.
- `SellerProfile.tsx`: the Follow/Unfollow button used `variant="danger"` (the `live` red fill,
  same colour as the LIVE badge and outbid errors) once followed. Checked the live screen's own
  Follow/bell control (`LiveSellerHeader.tsx`) for the reference behaviour — it never turns red,
  it turns into a neutral white pill. Changed Unfollow to `variant="secondary"`, per `design.md`
  §2's rule to differentiate actions with weight/variant, not a second colour.

**Noted, not implemented (feature-shaped, not a fix):** `MyBidsList` shows bid status
("Leading"/"Outbid"/"Won"/"Lost") as plain muted text inside `MenuRow`'s generic `detail` string.
`design.md` §2 names `success`/`warning` specifically for "You're winning"/"You've been outbid" —
colour-coding this would match that intent well, but doing it requires `MenuRow` to accept styled
detail content (or a bespoke row), which is a component change beyond a polish pass. Worth raising
with the founder as a UX enhancement, not bundled in here.

## Phase 4 — Orders and checkout (DONE, 2026-10-07)

`MyOrders.tsx` and `MyOrderDetail.tsx` (the real, routed order screens — `ProfileNavigator.tsx`
wires `ROUTES.ORDERS`/`ROUTES.ORDER` to these) are already fully clean: built from `Screen`/
`MenuRow`/`Button`/`EmptyState`/`AppText`/`Section` only, no raw colour or stray literals. No
changes made. Considered adding a `Badge` for order status in `MyOrderDetail` (it's currently
plain bold text, and other detail screens badge their status) but backed off: there are 8 order
statuses (`PENDING_PAYMENT`…`DISPUTED`) and no documented colour mapping for them — guessing one
risks misrepresenting real order/money state, which is exactly the kind of invented business
categorization the project's ground rules warn against. Flagging for the founder to specify if
wanted, not doing it silently.

`Checkout.tsx` was left untouched beyond Phase 0's existing `brandSoft` fix — per this file's own
earlier note (still correct), it's the old mock flow and full visual polish should wait until it's
wired to the real address/pay routes, to avoid redoing the work twice.

**Found, not touched:** `frontend/src/screens/personal/Orders.tsx` and `OrderDetail.tsx` are dead
code — re-exported from `Personal.tsx` but not imported by any navigator (`ProfileNavigator.tsx`
routes `ROUTES.ORDERS`/`ROUTES.ORDER` to `MyOrders`/`MyOrderDetail` instead). They're leftover mock
screens reading from the old `data` module, superseded by the real ones. Didn't delete them —
removing files is a bigger, less reversible action than a design pass calls for; flagging for the
user to confirm before deleting.

## Phase 5 — Auth (DONE, 2026-10-07)

Splash, Welcome, Onboarding were already fully clean (all-token media-surface dark panels, matching
section 7's convention). Two real fixes:
- `SignInScreen.tsx`: `auth.notice` (only ever set to "Email verified. Sign in to continue.", per
  `AuthProvider.tsx`) was coloured `colors.brand`. That's a confirmation message — `design.md` §2
  reserves `success` for exactly this. Changed to `colors.success`, same fix as Phase 3's
  `SaleActions.tsx`.
- `SignUpScreen.tsx`: the terms `Switch`'s `trackColor` only set `true`, leaving the off-state on
  the platform default grey instead of the app's own `colors.line`. Added `false: colors.line`.

**Flagging, not fixing — a content bug, not a styling one:** `AuthLayout.tsx` (shared by every
auth screen) ends with "Demo experience · Use fictional information. No account, email, or
payment is processed." Per this project's own status notes (`prompt.md` §5c), sign-up,
email-verification and sign-in are now fully real and live-verified against the real API — this
disclaimer is stale and tells users something false about a real account-creation flow. Didn't
rewrite it myself: the right replacement wording (remove it entirely vs. soften to something like
"Local development build") is the founder's call, not a design-token fix. **Needs an answer before
shipping**, flagging here and to the user directly.
- The same `Switch` `trackColor={{ true: ... }}` (missing `false`) pattern also exists in
  `Checkout.tsx` — not fixed there, since Checkout is under the Phase 4 hold.

## Phase 6 — Profile and settings (DONE, 2026-10-07)

Covered `Profile.tsx`, `SettingsScreen.tsx`, `EditProfileScreen.tsx`, `NotificationSettingsScreen`,
`HelpScreen`, and — since they all hang off the same `Settings` router and cost little extra to
check — `PrivacyScreen`, `SecurityScreen`, `AddressesScreen`, `PaymentsScreen`, `PayoutsScreen`,
`ReviewsScreen` too. Most were already fully clean.

- **Same `Switch` `trackColor` bug, found twice more**: `NotificationSettingsScreen.tsx` and
  `PrivacyScreen.tsx` both had `trackColor={{ true: colors.brand }}` with no `false`, leaving the
  off-state on the platform default grey instead of `colors.line`. Fixed both (this is now four
  occurrences total across the app — the fourth, `Checkout.tsx`, stays under the Phase 4 hold).
- **`Card` (`components/ui/Card.tsx`) had no elevation at all** — `design.md` §4 names
  `shadows.card` as "the only elevation style on paper surfaces," and this shared primitive (used
  by `Profile`, `PayoutsScreen`, `ReviewsScreen`, and also `OrderDetail`/`Checkout` from earlier
  phases) was a flat, shadowless block. Added `...shadows.card` to its base style — one change,
  cascades to every screen that uses `Card`, the same leverage pattern as Phase 1.
- `SecurityScreen.tsx` was already a good example of the system done right — its verified/
  not-verified `Badge` already uses `colors.success`/`colors.warning` exactly per `design.md` §2.

No changes needed in `EditProfileScreen`, `HelpScreen`, `SettingsScreen`, `AddressesScreen`,
`PaymentsScreen`, `PayoutsScreen`, `ReviewsScreen` — all already built cleanly from shared
components. `SettingsScreen`'s red "Log out" button (`variant="danger"`) was left alone — unlike
Phase 3's "Unfollow," ending a session is a common, deliberate use of a destructive-looking action
in comparable apps, not a casual toggle, so it doesn't share the same misuse pattern.

## Phase 7 — Seller tools (DONE, 2026-10-07)

All four (`SellHub`, `Dashboard`, `Listing`, `CreateShow`) were already clean and, notably, already
good examples of the system done right: `Dashboard`'s bar chart correctly uses `colors.chartSoft`
for the non-active bars (exactly its documented purpose — "a mid tint of brand, for secondary
chart/graph accents"), and both `SellHub` and `Listing` colour their status `Badge`s with
`success`/`textSecondary` rather than defaulting to `brand`. `Dashboard`/`CreateShow`'s `Card`
usage picks up Phase 6's new shadow automatically. No changes made — lowest priority, and nothing
found worth fixing.

## Cross-cutting fix — bottom nav bar visibility (2026-10-07)

Not part of a phase (`MainTabNavigator.tsx` isn't on any phase's screen list), fixed on request
after a screenshot showed the Discover tab bar effectively invisible. Root cause: the nav bar was
unconditionally `backgroundColor: "transparent"` with hardcoded `"#FFFFFF"` icon/label colour —
correct for the Live tab (video behind it) but white-on-white on every paper-surface tab. The file
already had a `dark` flag (`tab === ROUTES.LIVE && !route`) driving the screen background and
status bar; wired it into the nav bar too: `dark` keeps the transparent/white treatment unchanged
(checked first — a tinted active icon over video was explicitly tried and rejected before, per
`prompt.md`'s history, so left untouched), `!dark` now uses `colors.canvas` background,
`colors.line` top border, and — per `design.md` §2's documented "active nav icon's fill" rule,
which the code never actually implemented — `colors.brand` for the active tab's icon/label and
`colors.textSecondary` for inactive ones.

## Cross-cutting fix — missing product/seller images (2026-10-07)

User reported every product/seller image on Discover was a broken-image placeholder. Traced the
root cause: the real media pipeline (`ProductImage.storageKey`/`Channel.bannerKey` →
`storage.service.ts`'s `getPublicUrl()` → CDN URL) has apparently never been exercised in this
environment — MinIO (`docker-compose.yml`'s `minio` service) isn't part of the containers this
project runs, and `getPublicUrl()` has a latent bug of its own: it always builds `https://`, but
local `CDN_DOMAIN=localhost:9000` is plain HTTP (no TLS locally), so even a real upload wouldn't
have loaded in a browser. This isn't specific to the "Bid Test Jacket"/"Browse Channel" seed data —
no product in this local environment has ever had a working real photo.

Asked the user: fix the real pipeline (start MinIO, fix the `https://` bug, do real uploads) vs. a
fast frontend-only stock-photo fallback. They chose the fast path. Added
`frontend/src/utils/stock-image.ts` (`stockImageFor(id)`, a Picsum Photos URL seeded by the item's
own id — same item always gets the same photo, different items look different, no API key needed)
and wired it into every place a real image URL falls back to empty/null: `api/catalog.ts`'s
`toCard()` (the `CardProduct.image` field every grid uses), `ProductDetail.tsx`'s hero photo and
seller avatar, and the three channel-avatar call sites (`shared.tsx`'s `SellerList`,
`SellerProfile.tsx`, `ProductDetail.tsx`). The real pipeline's MinIO/https-scheme bug is still
there, unfixed — flagged here for whoever picks up real media uploads later.

## Cross-cutting fix — Welcome screen hero redesign (2026-10-07)

User flagged the Welcome screen's hero as bad: a flat black rounded box with a generic
`sparkles-outline` icon and a third, redundant tagline, asked for a genuinely elegant redesign.
Used the `impeccable` skill (loaded `DESIGN.md` + its craft-floor checklist first) rather than
guessing at taste — its own banned-pattern list names "icon + heading + text in a same-size card"
as the lazy default, which is exactly what the black box was.

First pass replaced it with a `BroadcastMark` (concentric rings radiating from a dot, echoing the
"radio-outline" logo glyph). User asked for something shop/auction-related instead, so swapped to
an `AuctionMark`: a `hammer-outline` gavel icon in a soft `colors.brandSoft` circle — reuses the
exact "icon in a brandSoft circle" treatment `EmptyState` (`components/ui/index.tsx`) already uses
elsewhere, rather than inventing a new convention. No gradients, no second colour, static on mount
(`design.md` §9). Dropped the box's old "Your next favorite. Found live." line — with the headline
and description already above it, a third near-duplicate tagline fought the decluttered result.
Ran the skill's mechanical detector (`detect.mjs`) against both passes: zero findings each time.

Only this one screen was touched — not a full visual-world redesign, so `PRODUCT.md`/`DESIGN.md`
weren't created/changed; `impeccable` flagged that as available via `/impeccable init` if a fuller
design-system documentation pass is ever wanted.

**Follow-up**: user then pointed at a second screen with the same black-box pattern —
`OnboardingScreen.tsx` (the 3-step carousel before Welcome), which the first screenshot was
actually of, not Welcome. Same fix, plus: promoted the "icon in a soft `brandSoft` circle"
treatment into a real shared component, `IconMark` (`components/ui/index.tsx`) — `EmptyState`
already did this exact thing inline, and now `WelcomeScreen` and `OnboardingScreen` needed it too,
so a third inline copy would have let three places drift out of sync. `WelcomeScreen`'s one-off
`AuctionMark` was replaced with `IconMark`. Also swapped `ONBOARDING`'s icons
(`constants/app.ts`) to read more clearly as shop/auction per step: step 1 "Shop live. Discover
differently." now uses `storefront-outline` (was `radio-outline`, too literally broadcast-shaped
per the user's reaction), step 2 "Bid in real time." now uses `hammer-outline` (was
`flash-outline`) — step 3 ("Follow the sellers you love.") keeps `heart-outline`, already on
theme. Dropped the static "LIVE ENTERTAINMENT × GREAT FINDS" line that lived in the old black
box — identical on all three steps regardless of content, pure filler once the box is gone. Ran
`detect.mjs` again: zero findings.

## Cross-cutting redesign — Discover page (2026-10-07)

Founder feedback (relayed, with a reference screenshot of a dark-mode marketplace app — Trending
Today row, 3-column category/stream grid, tabbed category filter): Discover "feels old," wants (1)
real-feeling live-stream windows instead of individual product listings in "Popular auctions," 3
per row, Instagram-grid style; (2) categories as image-and-text boxes in a single left-to-right
row instead of plain text chips; general "superior version" polish. Used the `impeccable` skill's
craft-floor checklist again while building this.

**Two real constraints shaped the result, flagged here rather than silently worked around:**
- `GET /streams/live` is a real, wired backend endpoint, but nothing in this app can create a live
  stream yet (no create/start routes — blocked on D-005, same as Phase 8 below), so it always
  returns empty. Wiring Discover to it would render an empty grid with no onward navigation (no
  real stream-detail screen exists either). Used the same 4 mock streams (`data/streams.ts`) the
  Home/Live tab itself already runs on instead — tapping one calls `app.selectStream(id)`, the
  same working jump-to-Live-tab navigation `Profile.tsx`'s "Explore live shows" already uses. This
  keeps Discover honest about current app state (mock until streaming ships) rather than
  half-wiring a dead-end real endpoint.
- `Category` has no image field in the data model (03-DATA-MODEL.md) — there's no real photo to
  show per category. Tried a keyword-based stock-photo service (`loremflickr.com`) first and
  verified it before using it (per this session's standing practice of checking before trusting an
  external URL) — it returned 401, unusable. Mapped each of the 6 top-level categories to a
  representative Ionicon in a tinted square tile instead (`shared.tsx`'s `CATEGORY_ICONS`:
  Fashion→`shirt-outline`, Electronics→`hardware-chip-outline`, Home & Living→`home-outline`,
  Beauty→`color-palette-outline`, Collectibles & Toys→`game-controller-outline`, Sports→
  `basketball-outline`), not literal photography like the reference screenshot's tiles.

**Changes:**
- `shared.tsx`: new `CategoryRow` — image-and-text tiles (icon-in-a-square + label), single
  horizontal scroll row, selected state brand-filled, replaces the old `Chips` text-pill row in
  `Discover.tsx`. Selection/filtering behaviour for "Latest finds" below is unchanged.
- `StreamCard.tsx`: rebuilt for a 3-per-row grid — bare photo (no card chrome, matching
  `ProductCard`'s existing idiom so Discover's two grids read as one family) + a one-line title +
  a small live-dot viewer count, dropped the seller avatar/name/tagline the old 2-column version
  carried (narrower columns, and the reference tiles don't show a seller either). This component
  was previously dead code (built in Phase 1, never actually used anywhere) — now it's live.
- `Discover.tsx`: "Popular auctions" (individual product-listing cards) replaced with "Live now" —
  the 3-column `StreamCard` grid. "Latest finds" (per-category real product browsing) is
  unchanged; the founder's complaint was specifically about auction-style individual listings as
  the headline content, not category browsing itself.

Ran `detect.mjs` against all three changed files: zero findings. `loadAuctionCards` in
`api/catalog.ts` is now unused (nothing else called it) — left defined rather than deleted, same
reasoning as the dead `Orders.tsx`/`OrderDetail.tsx` from Phase 4: it's still correct, reusable
code, and deleting working code nobody asked to remove goes beyond this task.

**Correction, same day**: the founder's follow-up (reacting to the above) clarified what "category
section... that's what live streams would be" actually meant — not a 3-column packed grid at all.
Re-read as: rectangular cards (not square), sized and laid out like the reference screenshot's
"Trending Today" row specifically (single horizontal scroll, not "rows of three by three up and
down"), no LIVE badge ("that live button isn't necessary"), and something that reads as an actual
live preview rather than a random static photo ("you can see streams happening without clicking").
Rebuilt `StreamCard` again: fixed-width (152) rectangular cards in a horizontal `ScrollView`
(`Discover.tsx`), and swapped the static `Photo` for a small muted looping `expo-video` preview —
reusing the app's own 9 real video clips (`data/live-reels.ts`) already wired for the Home/Live
feed, rather than a photo. Paired each card with the *same* video `Live.tsx` would jump to for that
stream id (same `i % streams.length` cycling logic), so the preview matches what plays after
tapping in. Dropped the `LiveBadge`/"LIVE" pill entirely; kept the "SOON" badge only for the one
upcoming (not-yet-live) stream, since that's a different, necessary distinction, not the badge the
founder was pointing at. The `CategoryRow` tiles (Fashion/Electronics/etc.) were not part of this
feedback at all and are unchanged. Ran `detect.mjs` again: zero findings.

## Cross-cutting fix — SearchBar + Discover subtext (2026-10-07)

Founder: drop the "Find your people. Find your next favorite." subtext on Discover, and make the
search bar smaller and actually transparent (it was filled `softCanvas`, 50px tall).

- `SearchBar` (`components/ui/index.tsx`) is shared with `Search.tsx` too, so this changed for both
  screens — didn't touch the shared `s.input` stylesheet entry though, since that's also `Field`'s
  base style and used by every form field app-wide (Checkout, auth screens, settings); gave
  `SearchBar` its own inline style instead so nothing else shifted. New: no fill, a thin
  `colors.line` hairline border, `radii.pill`, padding cut roughly in half (50px tall → ~36px).
  The clear ("×") button was `IconButton`, whose 44px minimum touch target would have forced the
  row back to its old height the moment there's text to clear — swapped it for a plain `Pressable`
  with `hitSlop` instead so the compact height holds in every state.
- `Discover.tsx`: removed the subtext line entirely (and its now-unused `AppText` import).

Ran `detect.mjs`: zero findings.

## Correction — categories as a grid, not a row (2026-10-07)

Founder clarified with a second screenshot callout: "categories should be displayed like these
cards" — pointing specifically at the reference app's "Categories" grid section (Events, Trading
Card Games, Video Games, Sports Cards, Electronics…), not the "Trending Today" row the live-stream
redesign above was modelled on. Previous `CategoryRow` (small 64px icon chips, single scrolling
row) replaced with `CategoryGrid` (`shared.tsx`): three-per-row, image-dominant square tiles (same
`CATEGORY_ICONS` mapping, scaled up to size 36 in a full-width square tile) with the label below,
wrapping inline in the page the way the reference grid does, not a horizontal scroller. Added a
"Categories" `Section` heading above it, matching the reference and the rest of the page's
structure. Selected-state and the "All" pseudo-category behave the same as before (brand-filled
tile, same filtering of "Latest finds" below).

**Deliberately left off**: the reference's per-category "X Viewers" line. That's a live-activity
metric aggregated from real streams in that category — this app has no such aggregation (no
endpoint for it, and "streams" here are still the Phase-8-blocked mock set), so showing a number
would be invented, not real. Flagging rather than faking it, consistent with how the live-streams
section itself was kept honest about being demo content.

Ran `detect.mjs`: zero findings.

## Correction #2 — categories as "Trending Today" rectangles, not the square grid (2026-10-07)

Founder clarified once more, with a cropped screenshot of just the "Trending Today" row: wants
the category section to be exactly that card recipe — rectangular (not square), a watching-count
shown per card, single horizontally-scrolling row (the reference's apparent "2 rows" was just a
scroll-width wrap, not an intended 2-row layout). `CategoryGrid` (the 3-per-row square version
from the previous correction) replaced with `CategoryRow` in `shared.tsx`: same 152-wide,
1.4-aspect rectangular card recipe as the `StreamCard` row right below it on the page, so the two
"Trending Today"-style rows on Discover now share one visual recipe, just with different content
(category icon instead of video). Selected state changed from a solid brand fill (too heavy for
this photo-card style) to a 2px brand border, since these now read as content cards rather than
filter chips.

**Explicitly flagged, shown anyway because asked for twice**: the founder wants a "how many people
watching" number per category. No such metric exists anywhere in this backend — there's no
per-category viewer aggregation endpoint. Added `placeholderWatching()`: a deterministic hash of
the category's own id, formatted like the reference ("965", "2.4K"), so it's stable across renders
rather than flickering, but it is a **display placeholder, not real data** — told the user this
directly rather than letting a convincing-looking number pass as real traffic.

Detector run attempted but the tool's safety classifier returned a transient error both times;
manually re-read both changed files for correctness instead of blocking on it.

## Correction #3 — slim pill cards, "All" moved to a section action (2026-10-07)

Founder: the rectangle cards were "very broad," wanted them slim/pill-shaped with the title and
watching-count *inside* the card rather than stacked below it; also wanted "All" out of the card
row entirely, replaced with an "All" text-plus-arrow action in the top-right of the section
heading, and the row below showing only real categories.

- `CategoryRow` (`shared.tsx`) rebuilt again: each card is now a horizontal pill — icon on the
  left, a title/watching-count text stack beside it, all inside one `radii.pill` rounded
  container (150 wide, content-height instead of the previous 1.4-aspect box). Selected state is
  a full brand fill (text turns white) rather than a border, matching the rest of the app's chip
  selection convention now that these read more like compact chips again.
- `categories.map` no longer has an injected "All" entry — the function signature/behaviour is
  otherwise the same (`value`/`onChange` still drive "Latest finds" below).
- `Discover.tsx`: `<Section title="Categories" />` now uses the same `action`/`onPress` pattern
  "Trending sellers" already uses (`action="All"`, `onPress={() => setPicked("All")}`) — reuses an
  existing, working UI pattern rather than building a new one for "All."

Detector still returning the transient classifier error — flagging again for a real run once the
tool's available; manually reviewed the diff in the meantime.

## Correction #4 — card corners, not a pill (2026-10-07)

Founder: the cards shouldn't be fully rounded, and should match the reference's size — the
reference's corners are soft but clearly a rectangle, not a stadium/pill shape. `CategoryRow`'s
card `borderRadius` changed from `radii.pill` (999) to `radii.card` (18); everything else
(150-wide, icon-left/text-stack-right layout, selected-fill behaviour) unchanged — this was a
focused one-property fix, not a rebuild. Detector still transient-erroring; not re-attempted a
fourth time this session per its own backoff guidance.

## Correction #5 — category title never wraps/truncates (2026-10-07)

Founder: the category title should always stay on one line, and the card should grow to fit it
rather than truncating. `CategoryRow`'s card dropped its fixed `width: 150` and the text-stack's
`flex: 1` — each card now sizes to its own content (icon + widest of title/watching-count line +
padding), so a short name gets a compact card and a long one ("Beauty & Personal Care") gets a
wider card automatically, never wrapping. `numberOfLines={1}` stays on as a safety net but
shouldn't actually need to truncate anything now. Detector ran clean this time (transient error
from the last two corrections cleared).

**Flagged, not silently fixed**: re-reading the file to verify this edit, `CATEGORY_ICONS`'s
Fashion key had changed from `"fashion-accessories"` to `"fashion"` on disk, not matching the real
backend slug (confirmed via the live API) — as it stands, Fashion & Accessories falls back to the
generic grid icon instead of the shirt icon. Origin unclear (didn't come from this session's own
edits to that line) — surfaced to the user rather than reverting it unilaterally.

## Correction #6 — simplify the page, portrait stream grid, real category filtering (2026-10-08)

Founder: drop "Trending sellers" and everything below it from Discover — only Categories and
"Live now" stay. Live streams should be unbounded (no cap) and filtered by the selected category
("no matter how many of them"). Stream cards should be portrait/vertical, matching an attached
reference image, with title and watching-count overlaid inside the card in white text — "just how
we did for the chat and peoples username on the live screen" (`design.md` §7's text-shadow
convention, not a translucent pill).

- `Discover.tsx`: removed `Section("Trending sellers")`/`SellerList` and the per-category
  `Section`/`AsyncProductGrid` for "Latest finds" entirely. "Live now" now renders every stream
  that matches the selected category (or all of them, unfiltered, under "All") in a wrapping
  `s.grid` — the same unbounded-grid idiom `ProductGrid` already uses, not a capped horizontal
  row, so it scales to however many streams exist without a redesign later. Empty state
  (`EmptyState`) for a category with no live streams right now.
- **Streams needed a real category link to filter by**, which didn't exist — added
  `categorySlug: string` to the `Stream` type (`types/stream.ts`) and set it on each of the 4 mock
  streams (`data/streams.ts`), mapped from their mock product's category to the matching real
  backend category slug (sneakers/jacket → `fashion-accessories`, headphones → `electronics`). Mock
  data describing mock data, same honesty level as everything else flagged this session — not a
  new invented business fact, just making the existing demo set filterable.
- `StreamCard.tsx`: portrait (`aspectRatio: 0.72`, was a 1.4 landscape rectangle), two-per-row.
  Title and watching-count moved from below the card to overlaid at the bottom of the video itself,
  white text with the same `textShadowColor/Radius/Offset` triple `LiveSellerHeader.tsx`'s chat
  overlay already defines — reused the exact values rather than inventing a new shadow recipe.

**Found, not touched**: `SellerList` (`shared.tsx`) has no remaining caller anywhere in the app now
that Discover dropped it — left defined rather than deleted, same reasoning as the other dead-code
flags this session (`Orders.tsx`, `loadAuctionCards`).

Ran `detect.mjs` against every changed file: zero findings.

## Correction #7 — all 9 videos, no upcoming ones (2026-10-08)

Founder: show all the videos for now, and never show the "upcoming" one — only fully live.

Discover's "Live now" was built off the 4-item `streams` list (one card per stream, cycling the
same video for repeats). Switched it to `liveReels` instead — the 9-item video-to-stream pairing
`Live.tsx` already builds for the swipeable feed itself, now pulled out into
`data/live-reels.ts` as a shared export (`liveReels`) instead of living only inside `Live.tsx`, so
both screens read the exact same source instead of Discover re-deriving its own guess at which
video goes with which stream. `Live.tsx` now imports `liveReels` rather than computing it locally
— same 9 reels, same behaviour, just defined once.

- `StreamCard` now takes a `reel` (`{ key, source, stream }`) instead of a bare `stream` — it plays
  `reel.source` directly rather than re-deriving a video via the old `videoFor()` lookup, which is
  gone. Simpler and no longer a second guess at a pairing that already exists.
- `Discover.tsx`: filters `liveReels` to `!reel.stream.upcoming` first (so the one stream marked
  upcoming, and both reels cycled onto it, never appear), then by category on top of that. 7 of
  the 9 reels show under "All" now; previously only 3 stream-cards did.

Ran `detect.mjs` against every changed file: zero findings.

## Correction #8 — stream cards 3-per-row, less rounded (2026-10-08)

`StreamCard`: width `"48%"` (2-per-row) → `"31%"` (3-per-row, matching the attached reference
image), corner radius `radii.card` (18) → `radii.md` (14). Portrait aspect ratio, overlay text,
and everything else unchanged. Detector clean.

## Correction #9 — stream card text scaled down to match the smaller 3-col card (2026-10-08)

Title/watching text hadn't been resized when the cards shrank from 2 to 3 per row — title 14→11,
watching 12→9, live-dot 6→5, overlay inset 10→8. Detector clean.

## Correction #10 — "Live Now" capitalization, black search icon (2026-10-08)

`Discover.tsx`: "Live now" → "Live Now". `SearchBar`'s magnifying-glass icon recoloured from
`colors.textSecondary` (grey) to `colors.text` (the app's near-black foreground token, not a raw
`#000` — stays inside the palette) — shared with `Search.tsx` too, same as every other `SearchBar`
change this session. Detector clean.

## Correction #11 — real bug: `AppText` silently dropped `numberOfLines` (2026-10-08)

Founder's screenshot showed the second stream card's title and watching-count visually colliding
with the video's own content. Root cause: `AppText` (`components/ui/index.tsx`) never declared or
forwarded a `numberOfLines` prop to the underlying `Text` — every `numberOfLines={1}` passed to it
this session (both `StreamCard` lines, both `CategoryRow` lines) was silently swallowed, doing
nothing. Without that cap, a long title could wrap to a second line and push down into the
watching-count row under it. Grepped the rest of the codebase first — confirmed this pattern
(`AppText` + `numberOfLines`) didn't exist anywhere before this session, so it's a bug introduced
this session, not a pre-existing one. Fixed at the `AppText` level (one shared-component fix,
cascades to every caller, same leverage pattern as Phase 1) — added `numberOfLines?: number` to
its props and passed it through to `Text`.

Also trimmed `StreamCard`'s overlay text a bit further (title 11→10, watching 9→8) for margin on
the narrow 3-col card. Considered adding a translucent backing panel behind the text for extra
protection against unpredictable video content (`design.md` §1 does allow one "where a grouped
block is unavoidable"), but held off — the founder was explicit and repeated about wanting bare
text with shadow, matching the chat overlay, and the real cause was the `numberOfLines` bug, not
the shadow-only approach itself. Revisit the backing-panel idea only if this specific legibility
issue recurs after the real fix.

Ran `detect.mjs` against every changed file: zero findings.

## Phase 8 — Home feed: BLOCKED, not attempted

This phase is blocked on business decision **D-005** (LiveKit vs. Amazon IVS) and on the
streaming create/start/end routes not existing yet — it's not a design question, there's nothing
to polish until a real stream exists to design around. Per `prompt.md` §7 this is explicitly
"don't start without being asked." Skipped, not touched.

## Phase plan (not started unless marked)

| Phase | Screens | Status |
|---|---|---|
| 1. Shared components polish | `Button`, `Chips`, `Field`/`SearchBar`, `Badge`, `Sheet`, `IconButton`, `Screen`, `StreamCard` | DONE, 2026-10-07 — see above |
| 2. Browse | Discover, Search, Collection | DONE, 2026-10-07 — no changes needed, see above |
| 3. Product and seller | ProductDetail, SaleActions, SellerProfile, FollowingList, MyBidsList | DONE, 2026-10-07 — see below |
| 4. Orders and checkout | MyOrders, MyOrderDetail, Checkout | DONE, 2026-10-07 — see below |
| 5. Auth | SignIn, SignUp, Verification, Welcome, Onboarding, Splash | DONE, 2026-10-07 — see below |
| 6. Profile and settings | Profile, EditProfile, Settings, Notifications (mock), Help (mock) | DONE, 2026-10-07 — see below |
| 7. Seller tools | SellHub, Dashboard, Listing, CreateShow | DONE, 2026-10-07 — no changes needed, see below |
| 8. Home feed | The vertical live/shop feed | BLOCKED on D-005 + streaming routes — not attempted, see above |

## Design system reference

See `design.md` for the full system. Quick status:

| Item | Status |
|---|---|
| Colours, type scale, spacing, radii, shadows | DEFINED — `design.md` §2–4 |
| Core components (buttons, chips, fields, sheets) | DEFINED in code, not yet visually re-reviewed since the colour change (Phase 1) |
| Icon system (Feather vs Ionicons, outline/filled rule) | DEFINED — `design.md` §6 |
| Motion timing | DEFINED — `design.md` §9 |
| Dark mode | NOT DEFINED — not asked for |
| Phone layout check | NOT DONE for non-live screens (web preview only) |

## Decisions needed
- None blocking Phase 1. Confirm after Phase 1–2 land whether the per-screen pace and grouping
  above matches what you want to see next.
