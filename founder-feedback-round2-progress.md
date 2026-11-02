# founder-feedback-round2-progress.md (local-only, never committed)

## STATUS: DONE, COMMITTED, DEPLOYED, HISTORICAL — read `prompt.md`'s highest-numbered status

## section for current state, not this file. Kept only for the verification detail below.

Everything in this file was committed as part of the large combined commit `79b5a9f` (23 Oct
2026, alongside the `live-issues-progress.md` arc, category icons, and the new wheel feature — the
user chose not to split the commit), pushed, and deployed live the same day. See `prompt.md` §19
for the deploy write-up. The paragraph below is the original, now-historical session-start note —
kept for context, not current state.

Started 21-22 Oct 2026, right after the scroll-nav/spin-the-wheel arc (`founder-ux-progress.md`,
now historical) was committed (`cb5ebc1`), deployed, and followed by an em-dash cleanup commit
(`3f1beaf`), also deployed. The founder then sent a batch of UI/UX feedback over chat (quoted in
full further down) while separately getting TestFlight set up for the first time. This file covers
BOTH threads since they ran interleaved in the same session.

---

## Part A: TestFlight setup — where it stands

Walked the founder (Louis Cooper, Mac: `Louiss-Mac-mini`, Apple ID `kidd16jake@yahoo.com`, Expo
account `dreamswonder-2`) through getting a build onto his phone for the first time. Real facts,
not assumed:

- Repo was **downloaded as a zip**, not `git clone`d — local path on his Mac is
  `/Users/louiscooper/Downloads/Mint-main-1`. A `git init` was run there only because the EAS CLI
  needed _some_ local git repo to compute a build fingerprint; it is **not connected to our GitHub
  remote** in any way. This matters a lot for next session: **any backend/frontend fix made in
  this repo does NOT reach his Mac automatically.** Either he re-downloads/clones fresh, or fixes
  get hand-delivered as exact file edits (same as the `.env` file content below).
- EAS project: `@dreamswonder-2/shopaflo`, bundle id `com.shopaflo.app`, Apple team "Louis Cooper
  (Individual)". Distribution cert, provisioning profile, and push key were all **reused** from a
  9-month-old existing team setup (`@dreamswonder-2/belle`) — not freshly generated.
- **First EAS cloud build attempt stalled** mid-upload (genuinely stuck, not just slow — confirmed
  by the byte counter not moving for several minutes on a good connection). Cancelling and rerunning
  `eas build --platform ios --profile production` picked the same cert/profile/key back up
  automatically and completed normally the second time.
- **Switched approaches mid-arc**: founder got impatient with the EAS cloud build queue and asked
  to use Xcode directly instead. Walked him through `npx expo prebuild --platform ios --clean` +
  opening `ios/Swish.xcworkspace` + Xcode's own Archive → Distribute App → App Store Connect flow.
  Both paths are legitimate; the EAS path is simpler/more automated, the Xcode path is faster once
  you're mid-queue-wait. **Two real bugs surfaced specifically because of this switch:**
  1. **ITMS-90683 Apple rejection**: missing `NSCameraUsageDescription`. Root cause: `@stripe/
stripe-react-native` references camera APIs internally (card-scan feature) even though this
     app's UI never calls it — Apple's static analysis flags the capability regardless of whether
     it's used. **Fixed**: added `NSCameraUsageDescription` under `ios.infoPlist` in
     `frontend/app.json` (already in this repo's working tree, needs manually re-applying to his
     `Mint-main-1` copy if he re-downloads instead of getting our fixed file).
  2. **"Can't reach the server" at runtime** — the Xcode-built binary silently fell back to
     `http://localhost:3000` instead of `https://api.swishfy.com`. Root cause: `eas build` reads
     `eas.json`'s `build.production.env` and injects `EXPO_PUBLIC_API_URL`/
     `EXPO_PUBLIC_REALTIME_URL` automatically; `expo prebuild` + a local Xcode archive does **not**
     go through that mechanism at all, and `frontend/.env` is gitignored so it never existed on his
     Mac. **Fixed**: had him create `frontend/.env` by hand with the two URLs, then redo
     `prebuild --clean` + re-archive.
  3. **Proactive fix, not yet triggered as a real rejection**: also added `expo-image-picker`'s
     config plugin with explicit `photosPermission`/`cameraPermission` strings ahead of time (for
     the new avatar-upload feature, Part B below) — same ITMS-90683 class of bug, pre-empted this
     time instead of waiting for a second rejection email.
- **App name collision**: "Swish" is taken on the App Store by someone else; Apple auto-assigned
  "Swish (9dab94)" as a placeholder listing name. Cosmetic only (App Store Connect listing name,
  not the bundle id, not anything user-facing in TestFlight) — rename later at
  appstoreconnect.apple.com whenever a real public name is decided. **Do NOT let anyone "fix" this
  by changing the Bundle ID** — that's a different, permanent identifier tied to the already-issued
  cert/profile; changing it means starting the whole Apple registration over.
- **Resolved (22 Oct 2026, next session)**: confirmed with the founder (relayed through the user)
  that the final corrected build finished processing and the app opens and reaches the real API.
  TestFlight setup is done, nothing further to chase here.
- Test accounts for him to log into whatever build he ends up with: see `deploy_progress.md`'s new
  "Production test accounts" section (buyer + seller + admin, all real production rows, not local).

---

## Part B: Founder's UI/UX feedback batch — punch list and status

Quoted conversation (lightly reordered, not edited) is preserved in this session's chat history;
the distilled punch list and what happened to each item:

1. **Auth bug** — "Don't have an account? Sign Up" button duplicated on the sign-in screen when it
   should only be on the first/welcome screen. **DONE** — resolved as a side effect of item 2
   below (removing the separate Welcome screen on mobile means the sign-in screen's own sign-up
   link is now the single, correct, non-duplicated entry point, same as web already has it).
2. **Bug** — mobile (TestFlight build) still showed the onboarding carousel + Welcome chooser
   screens; founder wanted it to match web exactly, which already skips straight to sign-in (web
   got this fix 15 Oct 2026). **DONE**. `RootNavigator.tsx` no longer special-cases
   `auth.state === "onboarding"`; `AuthNavigator.tsx`'s default case is now `SignInScreen` instead
   of `WelcomeScreen`. `OnboardingScreen.tsx`/`WelcomeScreen.tsx` are now fully orphaned dead code
   on both platforms (not deleted — flagged, not touched, see note at the end of this section).
3. **Bug** — no persistent sign-in on the phone; every relaunch signed the user out. **Root cause
   found**: native was using memory-only token storage (a pre-existing, explicitly flagged gap in
   `client.ts`'s own comment — "pending expo-secure-store approval"). **DONE** — installed
   `expo-secure-store` (`~15.0.8`), rewrote `token-store.ts` so native keeps the existing fast
   synchronous in-memory `get()`/`set()` for the request hot path but mirrors every write to secure
   storage in the background, loading it back once at launch (`TokenStore.hydrate()`, a new method
   on the interface) before `AuthProvider`'s first session-restore check.
4. **Bug** — the bottom nav bar auto-hides after 40s while watching a live stream and never comes
   back, "not even after reclicking." **Root cause found**: the 40s hide timer in
   `LiveMobileShell.tsx` only ever reset when swiping to a _different_ stream (`useEffect` keyed on
   `[index]`); tapping the screen toggled mute but touched nothing nav-related. **DONE** — tapping
   now also calls the same show-and-restart-timer function as swiping does.
5. **Feedback, agreed in chat** — "Activity" (notifications) shouldn't be its own bottom-nav tab;
   fold it into the existing Inbox entry point as one combined screen, "kinda like Reddit." **DONE**
   on both platforms. Removed from `TABS` (mobile bottom nav) and from the desktop web navbar's
   separate bell icon (both merged into a single Inbox unread dot). `InboxMobile.tsx` now has an
   internal Messages/Activity toggle instead of being two separate full-screen modes. Desktop web's
   existing two-column Inbox layout (Messages | Activity side by side, built 16 Oct) was untouched
   — it already satisfied the "combined" ask. The pre-existing bell icon on the mobile Discover
   screen still works, it just now opens the combined screen with Activity pre-selected instead of
   a dead-end activity-only view. A stale `/activity` URL on web now redirects correctly (lands on
   the Inbox tab with Activity selected) instead of erroring, since `/activity` is no longer a
   valid tab path.
6. **Feedback** — web navbar: "Swish" logo needs to be bigger, and it + the Home/Discover links
   need to be on the left (they were centered as a block on wide screens, leaving symmetric dead
   space on both sides and reading as "floating in the middle"). **DONE** — logo size 20→26,
   `navbarInner`'s `alignSelf` changed from `"center"` to `"flex-start"` (same fix pattern already
   used once before in this same file for the search bar, see its own comment).
7. **Feedback, NOT DONE** — "those big wide buttons" on the profile/account page should become
   smaller icon-based buttons sitting along the top instead of a tall stacked list. **Not started
   this session** — ran out of scope/time after the email-change feature (item 9). This is the
   next concrete UI item after the category-icon work (Part C) if the founder wants it before that.
8. **Feature, DONE** — profile picture upload. Found that the _entire backend pipeline_ (`POST
/me/avatar/upload-url` → presigned S3 PUT → `PATCH /me` with the resulting key) was already
   fully built and had simply never been called from the frontend (confirmed via
   `frontend/src/api/identity.ts`'s own stale comment: "display name only until file storage
   exists for avatars" — it already existed, nothing had been updated to say so). Verified the
   whole pipeline end-to-end against real production this session (see `deploy_progress.md`'s new
   S3/CloudFront section) before writing any frontend code. Built the picker UI in
   `EditProfileScreenMobile.tsx` with `expo-image-picker`, handling: permission denied, user
   cancels, oversized file (>10MB, matches the backend's own limit), unsupported file type, each of
   the three network calls (request-URL / S3 PUT / final save) failing independently with its own
   message, a "Remove photo" option, and a busy state that blocks double-taps mid-upload.
9. **Feature, DONE** — phone number field. The `User.phone` column already existed in the Prisma
   schema (`String? @unique`) but was never read, written, or exposed anywhere in the app. Added it
   through the full stack: domain entity, repository methods (`findByPhone`/`updatePhone`), a
   `findByPhone` uniqueness pre-check mirroring how email uniqueness is already checked at
   register (new `PhoneAlreadyInUseError` → `PHONE_ALREADY_IN_USE`, `409`), DTO validation (loose
   E.164 regex, kept byte-for-byte identical between `update-profile.dto.ts` on the backend and
   `validPhone()` in `frontend/src/utils/auth.ts`), and a real form field.
10. **Feature, DONE** — asked directly "can a user change their email/password, and can we send an
    email when that happens." Answer was yes to both, and both are now real:
    - `ChangePasswordUseCase` now publishes a `PasswordChangedEvent` after a successful change; a
      new notifications-module handler (`OnPasswordChangedHandler`) sends a plain security email
      via `NotificationsService.sendRawEmail` (the real Resend-backed channel, not the
      `ConsoleEmailNotifier` stub register/reset-password use) — no user-preference category gates
      it, a password-change alert isn't something an account owner should be able to silence.
    - Brand-new two-step change-email flow (nothing like it existed before): `POST /auth/request-
email-change` (current password + new email, nothing on the account changes yet, sends a
      confirm code to the new address _and_ a heads-up security email to the OLD address) then
      `POST /auth/confirm-email-change` (the code; only now does `User.email` actually change,
      marked verified since clicking/pasting the code proves ownership, and — same as password
      change — every other session gets signed out). The two-step shape specifically avoids a
      mistyped new email ever locking someone out: nothing changes until the code is confirmed.
      New frontend screen `ChangeEmailScreen` (+ `.web` 2-column variant + `Mobile` base), wired
      into the Security screen next to "Change password." Confirm-code delivery also gets logged
      server-side as a fallback (see `deploy_progress.md`'s Resend-sandboxed note — this is the
      same reason the fallback exists).
11. **Not our action item** — category icons being small/not transparent: founder said he'd source
    better assets himself. **This is now the explicit next task** — see Part C.
12. **Not urgent, no action taken** — a branding/app-icon idea (a wave shape, or an interlocking
    "S," or an "S" drawn in a wave form). Just noted here in case it comes up again.

**One thing flagged, not fixed**: `OnboardingScreen.tsx` and `WelcomeScreen.tsx` are now fully
orphaned on both platforms (unreachable from normal navigation after item 2's fix), and the
"Replay onboarding" buttons in `SettingsMenu.tsx`/`Entry.tsx`/the old `WelcomeScreen.tsx` itself are
now inert everywhere (they already were on web before this session). Not deleted — out of scope of
what was asked. Worth a cleanup pass if anyone wants the dead code gone.

**Verification, 22 Oct 2026 (next session) — real local stack stood up, items actually clicked
through, one real bug found and fixed along the way.** Full detail:

- **Real bug found and fixed**: the API would not boot at all. `identity.module.ts` never got
  updated when `ChangePasswordUseCase`'s `EVENT_BUS` dependency and the two brand-new use cases
  (`RequestEmailChangeUseCase`, `ConfirmEmailChangeUseCase`) were added — `EventsModule` was never
  added to the module's `imports`, and the two new use cases were never added to its `providers`
  (even though `IdentityService` already constructor-injected them, and the controller/notifications
  side were both correctly wired). Nest's DI failed on boot with `EventBusPort` unresolved. Fixed by
  adding `EventsModule` to `identity.module.ts`'s imports and registering the two use cases as
  providers — three-line fix, `src/modules/identity/identity.module.ts`. This means **the entire
  two-step email-change feature (item 10) was never actually runnable before this fix**, despite
  being marked DONE — typecheck/lint don't catch missing DI wiring, only actually booting the app
  does. Confirms why this project's "exercise it for real" rule exists.
- **Verified live via real curl + real browser UI, not just typechecked**:
  - Change-password: real request, real fresh session returned, real `PasswordChangedEvent` →
    `OnPasswordChangedHandler` fired (confirmed in API logs; Resend call itself fails locally with
    `API key is invalid` — expected, local `.env` has no real Resend key, this is an environment
    limit, not a code bug).
  - Two-step change-email: full real round trip via curl AND again via the browser UI (fresh signup
    → verify → change password → change email with real confirm-code token pulled from the
    `OnEmailChangeRequestedHandler` fallback log line → re-signed-in with the new email AND new
    password afterward). Old email genuinely stops working, new email genuinely works. This is the
    strongest possible verification short of a real inbox.
  - Phone number field: set via the real Edit Profile UI, persisted, duplicate-phone 409 confirmed
    with a second real account.
  - Avatar upload pipeline: real presigned URL generated locally against the real production S3
    bucket (same bucket as prod, local `.env` has real AWS creds), "Change photo" UI reachable.
  - Items 1/2 (duplicate sign-up button, onboarding skip): confirmed on web — logging out lands
    directly on sign-in with exactly one "Don't have an account? Sign Up" link, no onboarding
    carousel. (Native already independently confirmed working via the founder's TestFlight build.)
  - Item 5 (Inbox/Activity merge): confirmed live — desktop web's two-column Messages|Activity
    layout intact, single Inbox icon in navbar (no separate bell). **One minor, non-blocking
    inconsistency found**: the stale `/activity` URL redirect (`useNavigation.web.ts`) does land on
    a valid Activity view as intended — no dead link — but it renders through `InboxNavigator` →
    `<Inbox activityOnly/>`, a different code path than the tab click uses, so at full desktop width
    it shows the narrow mobile-style Messages/Activity toggle UI instead of the wide two-column
    layout. Cosmetic only, not a dead-end; flagged, not fixed (out of scope of what was asked).
  - Item 6 (navbar logo/links left-aligned): confirmed live, matches the fix.
  - Item 7 (icon-based profile buttons): confirmed still the tall stacked list — matches "not
    started," no regression.
- **Not independently re-exercised live this session, by environment limitation, not skipped
  carelessly**:
  - Item 3 (persistent sign-in via `expo-secure-store`) needs a real native app restart, which
    can't happen in this Windows/browser dev environment — same limitation flagged in the prior
    session's note. Code path re-read, looks correct; genuinely needs a real device/simulator pass.
  - Item 4 (nav bar 40s-hide timer resetting on tap): confirmed by reading
    `frontend/src/LiveMobileShell.tsx`'s actual diff — `onReelTap()` now unconditionally calls the
    same `showNav()` function swiping already used, which clears and restarts the 40s timer, exactly
    as described. Not exercised with a real 40+ second wait on a real narrow/native viewport — this
    session's browser-window resize tool did not actually change the rendered viewport in this
    environment, so a true narrow-width live exercise wasn't possible here.
- `npm run typecheck` (backend and frontend) and `npm run lint` (backend) all re-confirmed clean
  after the identity.module.ts fix and the category-icon changes below, run visibly in chat each
  time, not backgrounded.

### Exact commands to restart the local stack (same as previous arcs)

```bash
cd "C:\Users\91639\OneDrive\Documents\Live-Auction-Backend"
docker compose up -d postgres redis
npm run dev:api        # background; wait for http://localhost:3000/health/ready to 200
npm run dev:realtime   # background
cd frontend
npx expo start --web --clear   # background; frontend/.env.local already points it at localhost
```

Stop the same way as always when done: find real PIDs via `netstat -ano | grep LISTENING`,
`taskkill //F //PID <pid>` for api/realtime/expo (`pkill -f` does not reliably match these process
trees on this Windows/Git-Bash setup, confirmed repeatedly across multiple sessions now), then
`docker compose down` (no `-v`, keep the seeded volume).

---

## Part C: NEXT TASK — category icons as transparent "sticker" style images

Founder wants the category pills' images (currently plain rectangular stock photos, see
`frontend/src/screens/marketplace/shared.tsx`'s `CATEGORY_IMAGES` map and its own comment for the
current Unsplash sources) replaced with transparent-background, sticker/die-cut-style icon
illustrations instead — one per category, no background, reads as a clean icon/sticker rather than
a photo.

**The six real categories** (from `GET /v1/categories`, keyed by slug, confirmed against the actual
backend data, not guessed): `fashion-accessories`, `electronics`, `home-living`,
`beauty-personal-care`, `collectibles-toys`, `sports-outdoors`.

**DONE, 22 Oct 2026 (next session) — verified live in browser.** The founder dropped 6 files into
`frontend/assets/categories/` (`<Category Name>-new.jpg`) mid-session. **Real problem found before
using them**: they were plain RGB JPEGs, not real transparent PNGs — whatever tool generated them
rendered its own "transparent" checkerboard preview and then flattened it into a JPEG, baking a
literal grey/white checkerboard pattern into the pixels. Dropped in as-is, every category pill
would have shown a visible checkerboard square behind the icon.

Fixed by writing a one-off conversion script (not committed, lived in the scratchpad dir only):
detects the real ink (saturated color + dark outline pixels), takes the single largest connected
blob per image, dilates it to also swallow the white die-cut sticker border, fills the result to
transparent everywhere else, trims each to its bounding box with a small uniform pad, and resizes
to a consistent 512×512 canvas. Verified visually at both full size and actual pill size (composited
onto solid color backdrops) before wiring in — all 6 came out clean, no checkerboard residue, no
cropped edges, and the artwork's own internal negative space (e.g. the hole in the headphones band)
correctly stayed transparent rather than getting filled in.

Code change: `CATEGORY_IMAGES` in `shared.tsx` now points at `.png` files (same slugs), and the
`Image` in `CategoryRow` got `resizeMode="contain"` (was implicitly `"cover"`, tuned for the old
full-bleed photos — would have cropped the new icons) plus a slightly larger 28×28 box. **Verified
live in the browser** at `/discover`: all 6 pills render correctly, transparent icon sitting on the
pill's own tint backing, no artifacts, consistent sizing across all 6.

The original `-new.jpg` exports and the old `.jpg` photos are still sitting in
`frontend/assets/categories/` (untracked/unused respectively) — not deleted, flagged for whoever
drafts the commit to decide whether to clean up.
