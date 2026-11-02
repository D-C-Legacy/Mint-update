# founder-feedback-round3-progress.md (local-only, never committed)

STATUS (closed out 24 Oct 2026): all 8 original items DONE. Committed as `5b9e52b`, pushed, and
deployed live on EC2 (confirmed via a real production registration + a real Resend delivery log
check, not just a health check). Real root causes were found and fixed along the way for #7
(`ConsoleEmailNotifier` was bound in every environment including production — the actual reason
verification emails never sent, not Resend sandbox mode as first guessed) and #8 (verification
token was a full JWT; replaced with a 6-digit Redis-backed code, plus a rate limit added after on
the user's explicit instruction — 10 attempts per 15 min per IP, flagged as not in `05-API-SPEC.md`
since every other scope in that file is).

**One small follow-up fix, same arc, still uncommitted**: founder reported (via a stale TestFlight
screenshot) that Log out read as a floating, centered, oddly-styled control — turned out he was
looking at an old build (the "Your session" header and "Replay onboarding" were already gone in
`5b9e52b`). The one real gap: Log out's row styling didn't match the other settings rows (centered,
not left-aligned like `MenuRow`). Fixed in `SettingsMenu.tsx` to match `MenuRow`'s exact layout
(same padding, border, left-aligned), kept the red color as the one deliberate difference (still a
destructive action). Typechecked clean, verified live. **Not committed yet** — single file,
`frontend/src/screens/personal/SettingsMenu.tsx`.

## Done this session

- **#1/#2 Replay onboarding**: removed entirely — not just from Settings, but from `WelcomeScreen`
  (same dead pattern) and a fully orphaned, unreachable `Entry.tsx` screen that turned up while
  fixing this (nothing navigated to it — deleted). `restartOnboarding` removed from `AuthProvider`
  since nothing calls it anymore.
- **#3 Settings back arrow**: removed from `SettingsScreen.tsx` — it's a tab root now, no back
  arrow on any of the other 4 tabs either.
- **#6 Discover bell**: removed from `DiscoverMobile.tsx`. Activity stays fully reachable via the
  Inbox tab's own Messages/Activity toggle, so nothing was lost.
- **#8 Verification token → 6-digit code**: real backend change. New
  `EmailVerificationCodeService` (Redis-backed, `email-verify-code:{code}` → userId, 15 min TTL,
  one-time use, collision-safe via `SET NX`). `register`/`verify-email` use cases and the Zod DTO
  all updated. Verified against the real local stack: registered a real account, pulled the real
  code straight out of Redis, verified with it, confirmed the code is deleted after use and a
  replay is rejected. Frontend field is now numeric, 6-digit max, proper keyboard.
- **Found and fixed the actual root cause of #7 along the way**: `EMAIL_NOTIFIER` was bound to
  `ConsoleEmailNotifier` **unconditionally in every environment, including production** — meaning
  verification (and password reset) emails were never actually sent for real, anywhere, ever. Not
  the Resend-sandbox-mode issue originally guessed. Added `ResendEmailNotifier` and wired it for
  staging/production (local keeps the console stub for the log-line dev workflow).
- **`verify-email` rate limiting — added 24 Oct 2026 on explicit instruction**: 10 attempts per 15
  min per IP (`src/config/rate-limit.config.ts`'s `verifyEmail` scope), same `RateLimitService`
  pattern used everywhere else in the backend. Not in `05-API-SPEC.md` §13 (flagged honestly in
  both the config comment and the new `VerifyEmailRateLimitedError`'s own comment, since every
  other scope in that file cites the spec and this one doesn't). Verified live: fired 12 wrong-code
  attempts against the real local API, got `429 RATE_LIMITED` with a `retryAfterSeconds` once the
  bucket emptied, clean `401 INVALID_TOKEN` before that.
- **#5 Category "watching" counts — done, not just recommended**: found hard evidence while
  verifying #6 live — the counts were 100% fabricated (`placeholderWatching()`, a hash-based fake
  number, with its own comment admitting "no real per-category viewer aggregation anywhere in this
  app"). Founder explicitly said dropping it was fine, so removed it rather than leave fake numbers
  showing. Category pills now just show icon + name.

## Done — #4, after the founder's follow-up ("should just be icons and text not buttons")

Replaced the filled `Button` blocks (Go live / Schedule show / Create listing) with a new shared
`SellerAction` tile — `IconMark`'s existing soft-circle icon treatment (already used on auth
screens, no new visual pattern invented) + a label underneath, no button fill. Applied in both
places this pattern existed, not just the one screenshot he sent:

- `SellHubMobile.tsx` (native app + narrow web) — the screen he screenshotted.
- `SellerPortal.web.tsx`'s Dashboard pane (desktop web) — same 3 actions were still filled buttons
  here too, just smaller ones from an earlier size-only fix; this is the first time the _style_
  itself was addressed, not just the size.
  `SellerAction` is exported once from `SellHubMobile.tsx` and reused by both, so they can't drift
  apart again. Typechecked clean, verified live on desktop web (real approved-seller test account,
  real dashboard pane, icons render correctly, all three navigate correctly). Mobile width uses the
  identical component, not verified in an actual narrow viewport this session (tooling limitation),
  but same code path.

## #7 Verification emails arriving for real

Code-side root cause (`ConsoleEmailNotifier` bound everywhere) is fixed. Founder verified his own
`swishfy.com` domain on a new Resend account himself (confirmed directly against Resend's own API:
`status: "verified"`, `sending: enabled`). `RESEND_API_KEY` and `RESEND_FROM_EMAIL` updated on the
server with his new key — real delivery should now work. Still needs a real end-to-end send test
with a real inbox to call this fully closed.

---

## 1. "Replay onboarding" acts like a sign-out — REAL BUG, root cause confirmed

Founder: "this weird replay onboarding thing... it kicks you out, it almost acts like it's a log out
as well."

`frontend/src/providers/AuthProvider.tsx`'s `restartOnboarding()` (~line 135) never clears the user
or tokens, but it does set `state: 'onboarding'`, which is enough to boot the UI straight to the
Welcome/auth flow — visually identical to `logout()`, even though technically still signed in
underneath. Confirmed by reading both functions side by side.

Fix direction (not yet built): either make `restartOnboarding` actually replay the onboarding
screens without leaving the authenticated shell, or — if "replay onboarding" isn't a real product
need — just remove the control entirely. Needs a decision on which.

## 2. "Your session" section + "Replay onboarding" placement on Settings — confusing

Founder doesn't understand why "Replay onboarding" lives on the settings page at all, or why
there's a "Your session" header. Likely resolves itself once #1 is decided (remove it entirely, or
move it somewhere that makes its purpose obvious — e.g. only reachable from first-run, not a
permanent settings row).

## 3. Unnecessary back arrow on Settings (mobile) — needs clarification

Founder: "Unnecessary back button... do you have these dead arrows?"

Likely culprit: `SettingsScreen.tsx` gives the Settings hub an unconditional `onBack={app.back}`,
left over from when Settings was always reached by navigating _into_ it from somewhere else. Now
that the Profile tab routes straight to this screen (today's consolidation), a back arrow on a tab
root doesn't make sense — none of the other 4 tabs (Home/Discover/Sell/Inbox) have one either.

Not 100% sure that's what "dead arrows" (plural) means though — could also include the `>` chevrons
on every row. **Ask the founder to confirm which arrows he means** before touching this.

## 4. Seller studio "giant buttons" — layout change requested

Founder: "Asked you to get rid of these unnecessary giant buttons" + wants the big "Go live" button
rearranged in the mobile layout. Screenshot shows `SellHubMobile.tsx`'s "Your studio" screen: large
"Go live" button, then two medium "Schedule show"/"Create listing" buttons below it.

File: `frontend/src/screens/seller/SellHubMobile.tsx`. No specific target layout given yet — needs
either a mockup/description from the founder or a proposed redesign from us before building.

## 5. Categories real-time viewer count — optional, founder's own words

"Categories sections should actually be pulling real time data on how many viewers are watching a
category or better yet we don't have to include it if you don't wanna make it wired that way."

Founder explicitly offered the escape hatch himself. Recommend skipping — no backend concept of
"viewers per category" exists today (streams don't carry a category, confirmed by `DiscoverMobile.tsx`'s own comment on `CategoryRow` no longer filtering), and building one is a real feature, not a
tweak. Flag as skip unless told otherwise.

## 6. Discover screen's notification bell — needs clarification

Founder: "Told you make the text icon a bell on the app" / "Discover section still has the belle
top right."

`DiscoverMobile.tsx` (~line 40) already has a real bell icon (`notifications-outline`) at top right,
linking to `ROUTES.ACTIVITY` — this looks like it predates this session. The phrasing implies the
founder asked for something specific about it before (remove it? consolidate with today's new web
bell?) that we don't have in this chat's visible history. **Don't guess — ask him directly what
should happen to this icon** before changing it.

## 7. Verification emails not arriving — known infra constraint, not purely a code bug

Founder: "I'm stuck at the verification token step. It won't send me the codes."

Already-known constraint (`deploy_progress.md`): Resend is in **sandbox mode** on production — it
only delivers to the account's own verified test addresses, never arbitrary real inboxes. If the
founder (or whoever he's testing with) used a real personal email, Resend silently drops it — no
error, just never arrives. Fixing this for real needs a verified sending domain on Resend (founder's
own action, DNS records), not a code change on our end.

**Worth confirming first**: which email address was he testing with — if it's not already a Resend-
verified test address, that alone explains it.

## 8. Verification token is too long — real, non-trivial change

The user's own words: "that token is so long we should keep short."

Confirmed: `register.usecase.ts` issues the verification token via `this.jwt.signPurposeToken(...)`
— a full JWT, easily 150+ characters. Founder wants something short instead (implicitly, a numeric
code like a 6-digit OTP — standard for email verification).

This isn't a one-line fix: a JWT is stateless and self-verifying; a short numeric code has much less
entropy and needs server-side storage with an expiry (and probably a rate limit on guesses) to stay
safe. Needs a design decision before building: code length (6 digits is the norm), expiry window,
and what happens on repeated wrong attempts.

---

## Not an action item, just a standing note

Founder: "our web behaves one way, our app behaves a little differently, and some of this stuff
crosses over a little." General cross-platform consistency concern, not a specific bug — worth
keeping in mind while working through the above (several of these items _are_ examples of exactly
this: the Discover bell, the Settings back arrow).

---

## Summary for quick reference

| #   | Item                                         | Status                                                               |
| --- | -------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Replay onboarding acts like log out          | Real bug, root cause known, fix direction needs a decision           |
| 2   | "Your session" / Replay onboarding placement | Likely resolved by #1's decision                                     |
| 3   | Unnecessary back arrow(s) on Settings        | Needs founder clarification on which arrows                          |
| 4   | Seller studio giant buttons                  | Needs a target layout before building                                |
| 5   | Category live-viewer counts                  | Recommend skip — founder gave the option                             |
| 6   | Discover screen bell icon                    | Needs founder clarification — missing prior context                  |
| 7   | Verification emails not arriving             | Known Resend sandbox constraint, needs founder's Resend domain setup |
| 8   | Verification token too long                  | Real change, needs code-length/expiry decision before building       |
