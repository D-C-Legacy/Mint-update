# design.md — Shopaflo design system

Written from the live screen, which is the app's most finished surface. Every value here already
lives in code — this file explains what the tokens mean and how to use them, it doesn't invent a
new system. Source of truth: `frontend/src/theme/*.ts` and `frontend/src/components/ui/index.tsx`.

No gradients, anywhere. No purple, anywhere — the one accent colour is the blue below.

---

## 1. Two surfaces, one palette

The app has two kinds of background, and the same tokens read differently on each:

- **Paper surface.** White or off-white background (`colors.canvas`, `colors.softCanvas`). Used on
  every browse, list, form and settings screen — Discover, Search, Product, Seller, Profile,
  Orders, Checkout, auth screens. Content sits in plain text and soft-shadowed cards
  (`shadows.card`), never a dark panel.
- **Media surface.** Full-bleed video or photo background (`colors.ink` behind it). Used only on
  the live screen today. Text sits directly over the media with a text shadow instead of a solid
  background box; where a grouped block is unavoidable (the product block, a sheet), it's a dark
  translucent panel (`rgba(16,16,20,0.7–0.8)`), never opaque.

Don't give a paper screen a dark glass panel, and don't give a media screen an opaque white card —
each surface has its own way of staying legible, built from the same palette.

## 2. Colour — `src/theme/colors.ts`

| Token | Value | Use |
|---|---|---|
| `brand` | `#004FD8` | The one accent colour. Primary buttons, the bid button, links, selected states, focus borders, the active nav icon's fill. Picked from the founder's reference swatch. |
| `brandSoft` | `#E7F0FF` | A pale tint of `brand`, for a selected option's background on a paper surface (see `Checkout.tsx`'s shipping option cards). |
| `chartSoft` | `#BFD8FF` | A mid tint of `brand`, for secondary chart/graph accents. |
| `live` | `#FF4057` | Status red: the LIVE badge, the "outbid" message. |
| `urgent` | `#FF1744` | A brighter red than `live`, reserved for things that must read as urgent against video — right now, only the closing countdown. Don't reach for this where `live` already does the job. |
| `success` | `#16A66A` | "You're winning", confirmations. |
| `warning` | `#F5A524` | "You've been outbid", caution states. |
| `ink` | `#0B0B0D` | Media-surface background. |
| `canvas` / `softCanvas` | `#FFFFFF` / `#F6F6F4` | Paper-surface backgrounds. |
| `text` / `textSecondary` | `#111113` / `#77777D` | Paper-surface text. |
| `line` / `mutedLine` | `#EAEAEA` / `#DDD` | Paper-surface hairlines and borders. |

**There is exactly one accent colour.** Never add a second brand hue. If a screen needs to
differentiate two actions, use weight and the `secondary`/`ghost` button variants (section 5), not
a second colour.

## 3. Typography — `src/theme/typography.ts`

Inter, loaded in `App.tsx` at four weights: Light (300), Regular (400), SemiBold (600), Bold (700).
Everything goes through the shared `AppText` component
(`frontend/src/components/ui/index.tsx`), which already applies the rules below — don't set
`fontWeight` or `letterSpacing` by hand.

- **Headings** (`size >= 20`): bold, `letterSpacing: -0.4`, tight line height (`size * 1.2`).
- **Body** (13–19px): regular or semibold (`bold` prop), default tracking, roomy line height
  (`size * 1.45`) for reading.
- **Small text** (`size <= 12`): slightly looser tracking (`+0.2`), for labels and metadata.
- **Type scale** (`typography.ts`): `display` 48 · `title` 32 · `section` 22 · `product` 17 ·
  `body` 15 · `meta` 13.

The one deliberate exception: comment text and usernames in the live chat overlay set their own
`fontFamily` directly (Light for the message, Bold for the name) to read clearly over video — see
section 7.

## 4. Spacing and shape

- **Spacing** (`theme/spacing.ts`): `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 20 · `xxl` 24 ·
  `section` 32 · `xxxl` 40 · `hero` 48. Use the named step, not a raw number.
- **Radii** (`theme/radii.ts`): `sm` 10 · `image` 12 · `md` 14 · `card` 18 · `cardLarge` 20 ·
  `xl` 24 · `button` 16 · `sheet` 28 (bottom sheets) · `pill` 999 (badges, chips, follow buttons,
  the bid button).
- **Shadow** (`theme/shadows.card`): the only elevation style on paper surfaces — a very soft
  4% black shadow, `shadowRadius: 12`. Media-surface panels use a hairline border or translucency
  instead of a shadow (shadows don't read against video).

## 5. Components — `src/components/ui/index.tsx`

These are shared by every screen. Polishing one of these improves every screen that uses it — fix
problems here before touching an individual screen.

- **`Button`** — four variants: `primary` (brand fill, white text), `secondary`/`light`
  (`softCanvas` fill, brand text), `ghost` (transparent), `danger` (`live` fill). A dedicated `bid`
  look exists only inline in `LiveProductPanel` (full-width, brand fill, white text) — don't
  duplicate it elsewhere; if another screen needs the same look, promote it to a `Button` variant
  instead of copying the inline style.
- **`IconButton`** — a bare icon with no background, for inline actions (back, clear, options).
- **`Chips`** — pill filter row; selected chip is brand-filled, others `softCanvas`.
- **`Badge`** / **`LiveBadge`** — small pill labels; colour passed in, defaults to `brand`.
- **`Field`** / **`SearchBar`** — `softCanvas` fill, brand border on focus, brand error colour is
  `live`.
- **`Sheet`** — the bottom-sheet modal every "more detail" or "confirm" interaction uses.
- **`Screen`** — the standard paper-surface page shell: title row, back button, scroll body.
- **`Photo`** / **`Avatar`** — image with a graceful fallback icon.

## 6. Icons

Two icon families, used deliberately, not interchangeably:

- **Feather** (`@expo/vector-icons`), always outline-weight — the live screen's action column
  (like, share, shop, wallet), the mute/sound glyph, chevrons. Pick Feather for an icon that sits
  directly on video or needs a light, linear feel.
- **Ionicons** — the bottom nav (`home`/`home-outline`, `search`/`search-outline`, etc.) and most
  paper-surface screens via the shared `Icon` component. Ionicons is the one family with matching
  outline/filled pairs, which the nav depends on: **outline when a tab is inactive, filled when
  it's active** — that's the only state Ionicons needs to carry; never add a coloured ring or box
  around it.

Don't mix a third icon family in. If Feather is missing a glyph Ionicons has (or the reverse),
prefer the family already used on that screen over introducing a new one.

## 7. Text and media (the "no boxes" rule)

Over video, text gets a shadow, not a background chip, wherever it can:

```ts
const shadow = {
  textShadowColor: "rgba(0,0,0,0.6)",
  textShadowRadius: 4,
  textShadowOffset: { width: 0, height: 1 },
};
```

Reach for a solid background only when text alone can't stay legible against bright or busy video
— the product block (`rgba(16,16,20,0.7–0.8)`) and the "Say something" bar (a thin
`rgba(255,255,255,0.7)` outline, no fill) are the only two places that do, and both stay
translucent rather than opaque. Everything else — the seller row, the chat lines, the price and
timer — is bare text with the shadow above.

## 8. Buttons and pills on media

- **Primary action** (Bid): full width, `radii.pill`, `colors.brand` fill, white bold text.
- **Secondary action** (Custom): same height, outline only (`rgba(255,255,255,0.75)`, 1px),
  transparent fill.
- **Status pills** (viewer count, LIVE badge): small, `radii.pill`, translucent dark fill
  (`rgba(16,16,20,0.45)`), not brand-coloured — a status pill is informational, not a call to
  action, and shouldn't compete with the one real accent colour.

## 9. Motion

Used sparingly, for state changes a person caused, not for decoration:

- **Follow → bell**: `Animated.spring` scale-in (`friction: 4, tension: 140`), then on the next
  tap, a quick wiggle sequence (five short `timing` steps alternating a small rotation) — see
  `LiveSellerHeader.tsx`.
- **Mute/unmute flash**: a centred icon scales up and fades out over ~600ms — see
  `ReelVideo.tsx`.
- **Bottom bar hide/show**: a 350ms `translateY` slide, paired with the content's bottom padding
  animating by the same duration so the live block visibly settles into the space the bar leaves —
  see `MainTabNavigator.tsx` and `Live.tsx`.

Keep new motion in this range (300–450ms, a spring or a short timing sequence). Nothing should
animate on mount just to look alive — only in response to an action.

## 10. Checklist for bringing a screen in line

Most screens already get the palette, type and spacing for free, because they're built from the
shared components in section 5 — confirmed by auditing every screen for hardcoded colour: the only
stray values found outside `theme/colors.ts` were a leftover purple tint in `Checkout.tsx` (fixed)
and a few literal `#FFFFFF`/`#111113` that already equal existing tokens. When refining a screen:

1. Check it's built from `Screen`, `Button`, `Chips`, `Field`, `Sheet`, `Badge` — not a one-off
   `View`/`Text` reimplementing one of these.
2. Check icons follow section 6 (right family, outline vs filled, no mixing).
3. Check spacing uses the named `spacing.*` steps, not raw numbers.
4. Check there's no second accent colour, no gradient, no hardcoded hex that isn't one of the
   values in section 2.
5. If the screen is a media surface, follow sections 7–9; if it's a paper surface, use
   `shadows.card` for elevation, never a dark panel.
