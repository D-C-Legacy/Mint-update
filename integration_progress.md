# integration_progress.md: Mobile app <-> backend integration tracker

Goal (user instruction, 11 Oct 2026): wire **everything** in the mobile app (`frontend/`) to the
real backend, **except streaming and storage** (no video provider, no S3/media uploads yet), and
make sure everything the user does is actually **saved** (profile, preferences, settings,
addresses, cards and the rest), then make the live parts real time. Work is split into phases;
each phase is built, then verified live against the real API, then this file is updated.

Method per phase (same discipline as `admin_progress.md`): survey the backend first, never invent
a field/route that isn't in the docs without flagging it, verify live (real API, real DB, browser
or API-level), write down what was found and not fixed. Git is the user's job (`prompt.md` §4).

## Starting state (verified 11 Oct 2026)

- Already real: sign-up, email verify, sign-in, session restore, browse (categories, products,
  sellers, search), follow, bid / buy now / offer, my bids, buyer orders list + detail.
- **No WebSocket client in the app.** "Live" = a 3 second poll on the product page. Nothing pushed.
- `PreferencesProvider` is entirely **in-memory mock** (a fake Visa 4242, a fake "Alex Morgan"
  address, notification + privacy toggles). Nothing is saved anywhere; it resets on reload.
- Stubs: edit profile, change password, forgot password, notification/privacy settings, addresses,
  payment methods, checkout, inbox/messages, reviews, payouts, help, seller tools.

## Backend gaps found while planning (what each phase has to add)

| Need | Backend today | Phase |
|---|---|---|
| Edit profile | `PATCH /me` documented, **not built** | 1 |
| Change password | **not in spec**, not built (user-directed addition) | 1 |
| Forgot / reset password | built (`/auth/forgot-password`, `/auth/reset-password`), app is mock | 1 |
| Notification + privacy preferences | **no model, no route, not in docs** (user-directed addition) | 2 |
| Push token registration | `Device` model exists, `POST /me/devices` **not built** | 2 |
| Address book | **no model**, spec only has a per-order address | 3 |
| Saved cards | `/payments/setup-intent`, `/payments/methods` documented, **not built**; no place stored for the Stripe customer id | 4 |
| Stripe webhook | stub, records events, applies nothing | 4 |
| Real-time | Socket.IO server works (`main.realtime.ts`), app has no client | 5 |
| Notifications inbox | `NotificationDelivery` model only, **no read route** | 6 |
| Order cancel | documented, **not built** | 6 |
| Seller balance / ledger / payouts | documented (§10), **not built** | 7 |
| Reviews, messages (DMs), help | **no models, not in docs** | 8 (built 13 Oct 2026) |

## Step 0 (before Phase 2): remove the false demo copy (user's call, 12 Oct 2026)

Remove, not reword: the auth footer "Demo experience · Use fictional information. No account,
email, or payment is processed." (`frontend/src/components/auth/AuthLayout.tsx`), plus the demo
wording in `AddressesScreen.tsx` and `PaymentsScreen.tsx` (those screens themselves are rebuilt in
Phases 3 and 4). Grep `frontend/src` for `demo|fictional|simulated|preview` and review each hit.
No layout or styling changes. Status: **DONE (12 Oct 2026)**. What was removed:
- `AuthLayout.tsx`: the whole footer paragraph (nothing replaces it).
- `AddressesScreen.tsx`: "Use fictional addresses for the demo." line removed.
- `PaymentsScreen.tsx`: the "Demo cards only..." line removed; "demo" dropped from the toast, the
  field label, the validation message ("Enter the last four digits.") and the two button labels.
- Other hits that were false now, so fixed: `SignUpScreen` ("I agree to the Terms and Privacy
  notice."), `Live.tsx` toast ("Verify your email from Settings."), `Entry.tsx` title ("Your
  session"), and the notification and privacy screens (rewritten in Phase 2).
- Hits **left on purpose** because the screen is still mock and the words are still true: Checkout
  ("UI preview only", rebuilt in Phases 3-4), Payouts, Help, `OrderDetail` (dead code), seller
  screens (`ControlRoom`, `CreateShow`, the seller block in `Live.tsx`), the "Preview states" row and
  `StateGallery` (Phase 9). Each loses its wording when its phase wires it for real.
- Verified in the real app (headless Chrome): onboarding and sign-in render with no demo text and
  no gap where the footer was. The sign-up screen was checked in source only (its link text is not
  clickable by exact match in my driver).

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1. Account and profile | `PATCH /me`, change password, real forgot/reset password, edit profile + security screens saved to the server, "verified" shown from the real account | **DONE** (verified live in the real app) |
| 2. Preferences and settings | Server-stored notification + privacy preferences (new model + routes), push-token registration, settings screens read/write them, survive reload and a new device | **DONE** (verified live; push-token routes built but the app has no token source yet, see write-up) |
| 3. Addresses and checkout | Saved address book (new model + CRUD), checkout sets the order address (`POST /orders/:id/address`), checkout screen un-mocked up to payment | **DONE** (verified live; payment step stays for Phase 4) |
| 4. Payments | Stripe customer + saved cards routes, in-app card entry and `POST /orders/:id/pay`, real Stripe webhook handling (3-D Secure, refunds, disputes) | **DONE** (verified live against Stripe test mode; in-app 3-D Secure prompt and phone card entry left, see write-up) |
| 5. Real time | Socket.IO client in the app: sale updates, bid accepted / outbid, auction extensions, replaces the 3 second poll | **DONE** (verified live; also fixed two backend event-delivery defects, see write-up) |
| 6. Notifications and order lifecycle | Notifications inbox (read route + app), order cancel, confirm delivery in the app, order status updates live | **DONE** (verified live; three real WS additions flagged, see write-up) |
| 7. Seller side | Seller application + bank account (no document upload, storage), seller profile, product CRUD (no images), seller orders + ship, balance / ledger / payouts routes + screens. **Creating a sale needs a stream session, so selling live stays blocked on streaming.** | **DONE** (verified live; see write-up — most of the seller backend already existed, the real gap was balance/ledger/payouts routes and the Sell tab had no status gating at all before this) |
| 8. Reviews, messages, help | Reviews (order-scoped, seller-respond, admin hide/unhide), buyer-initiated DMs, admin-authored help content, a generic report/moderation queue | **DONE** (verified live; see write-up — scope recommendations made and confirmed by the user, not a founder-relayed decision) |
| 9. Hardening | Hide winner/order fields on `GET /sales/:id`, 401 envelope, remove leftover mock data, full end-to-end pass in a real browser | **DONE** (verified live; see write-up — also fixed the same bare-exception bug in the 403 path, found adjacent to the flagged 401 one) |

## Decisions and flags

- **User-directed additions beyond the docs** (changes the "never invent a route" default, by the
  user's explicit instruction to make preferences and settings persist): change password, user
  preferences, address book. Each is flagged in its phase write-up so it can be reviewed.
- Avatar upload is excluded (needs storage). `PATCH /me` takes the display name only for now.
- Emails are not really sent (`ConsoleEmailNotifier`); verify and reset tokens come from the API
  log locally, same as verification today.

---

## Phase 1: Account and profile (DONE, verified live)

**Backend** (all in `src/modules/identity/`):
- `PATCH /v1/me` (documented in `05-API-SPEC.md` §2, was unbuilt): display name only, trimmed,
  1-100 chars. Avatar is excluded on purpose (needs storage). `GET /me` and `PATCH /me` share one
  response view.
- `POST /v1/auth/change-password` (**not in the spec, user-directed addition**): checks the
  current password, then signs every session out and opens one fresh session, returning new
  tokens so the device that made the change stays signed in. Uses the login rate budget (5 per 15
  minutes, keyed per user) so a stolen access token can't be used to guess the current password.
- New error code `CURRENT_PASSWORD_INCORRECT` (400, not 401, because a 401 would make the app try
  a pointless token refresh), registered in the backend registry and the app's copy of it.
- `forgot-password` / `reset-password` already existed and were not changed.

**App** (`frontend/src/`): `EditProfileScreen` saves for real and refreshes the profile;
`ChangePasswordScreen` is real and shows "Your current password is incorrect." inline;
`ForgotPasswordScreen` is a real two-step flow (request, then token + new password); the Security
screen now shows the **real** verified state and the real email instead of the old local
"six-digit preview" and "Demo session" text; `api/identity.ts` has the four new calls;
`AuthProvider` exposes `setNotice` so the sign-in page can say "Password reset...".

**Verified live** (real API + real Postgres, real app in headless Chrome):
- API checks: rename persists on a fresh `GET /me`; blank name 400; no token 401; wrong current
  password gives the new error code; correct change gives fresh tokens; the **old refresh token is
  revoked (401)** and the new one works; old password 401, new password 200.
- In the app: edit name, Save, profile shows the new name and the **server holds it**; wrong
  current password shows the inline error; correct change shows the toast, stored tokens are
  replaced and the app stays signed in after a reload; "Verify your email" with the token from the
  API log flips the badge to VERIFIED and the server stores `emailVerifiedAt`; log out; forgot
  password, a wrong token is rejected with a clear message, the right token resets, the notice
  shows on sign-in, signing in with the new password works, the previous password is refused.
- Backend `tsc --noEmit` clean. App `tsc --noEmit` clean (needs `NODE_OPTIONS=--max-old-space-size=8192`,
  it runs out of memory at the default heap, not a code problem).

**Found, not fixed (flagged):**
- The sign-in / sign-up / forgot screens still show the footer "Demo experience · Use fictional
  information. No account, email, or payment is processed." That is now false. It is the same open
  item `design_progress.md` already lists (needs a founder call on the wording), so left alone.
- Settings still lists "Preview states" (a developer screen gallery). Remove it in Phase 9.
- Edit profile has no photo or other fields: photo needs storage, and the backend `User` has no
  other profile fields. Nothing was invented.
- Reset and verification tokens are copied from the API log until a real email provider is set up.
- "Active sessions" was removed from Security (it showed fake "Demo session" text and no sessions
  list route exists). Add it back only if a list-sessions route is built.

**Test account left in the dev database:** `p1-1791702038@example.com`, password
`Reset321Password!`, name "Browser Edited", email verified.

---

## Phase 2: Preferences and settings (DONE, verified live, 12 Oct 2026)

**Backend** (all in `src/modules/identity/`, same layering as Phase 1):
- New Prisma model `UserPreference` (one row per user, columns for 4 notification + 3 privacy
  booleans, cascade delete) and migration `20261012000000_user_preferences`, applied with
  `migrate deploy`; `migrate diff` against the schema shows no drift. **Not in the docs, added on
  the user's instruction.**
- `GET /v1/me/preferences` returns `{notifications:{live,bids,orders,messages},
  privacy:{publicProfile,showActivity,onlineStatus}}`. No stored row means the defaults (all on
  except `showActivity`, same as the old mock). **Not in the spec.**
- `PATCH /v1/me/preferences` (**deviation from the suggested PUT**): a partial update, because the
  app saves one toggle at a time and a full replace would let two quick toggles overwrite each
  other. Zod `.strict()`, booleans only, empty body or empty group is a 400, unknown keys 400.
  **Not in the spec.**
- `POST /v1/me/devices` (200, idempotent by push token; a token held by another account moves to
  the caller) and `DELETE /v1/me/devices/:id` (404 for a missing **or someone else's** id, so ids
  can't be probed), both from `05-API-SPEC.md` §2. New `DeviceNotFoundError` uses the generic
  `NOT_FOUND` code (no registry change). The device port gained `upsertByPushToken` and
  `deleteOwned`. Identity module now provides its own `CLOCK`.
- Backend `tsc --noEmit` clean.

**App** (`frontend/src/`): `api/preferences.ts` (new: fetch, save, registerDevice, removeDevice);
`PreferencesProvider` loads the server copy after sign-in, clears it on sign-out, saves each toggle
optimistically and rolls back if the server refuses; `ready` / `loadFailed` / `reload` added.
`NotificationSettingsScreen` and `PrivacyScreen` use it: switches are disabled until the server copy
has loaded, a failed save puts the switch back and toasts "Couldn't save that change. Try again.",
a failed load shows "Couldn't load your preferences." with Try again. The "in this demo" and
"stay in this session" text is gone. `setNotifications` / `setPrivacy` were removed from the context
(only these two screens used them). Payments, addresses and the `verified` flag in the provider are
still the mock (Phases 3 and 4). App `tsc --noEmit` clean.

**Verified live** (real API + real Postgres + Redis; real app in headless Chrome):
- API script, 20/20: defaults for a new user; a patch saves and leaves other fields alone; a second
  login (new session) and a fresh GET see it; another user is unaffected; empty body, empty group,
  non-boolean, unknown key and no token are rejected (400/400/400/400/401); device register 200,
  same token again returns the same id, empty token and bad platform 400, other user's delete 404,
  owner delete 200, repeat delete 404, token moves to a new owner and the old owner then gets 404.
- Browser script, 14/14: onboarding and sign-in have no demo text; Notifications loads the server's
  state; toggling Bid updates and Messages each shows up on the server at once with the other fields
  kept; after a full reload the switches match the server; with the network forced offline a toggle
  rolls back, shows the message, and the server is unchanged; Privacy loads defaults and its two
  toggles are saved; a **brand-new browser profile** (new device, new session) shows the saved
  privacy choices. The test account was reset to defaults afterwards.

**Found, not fixed (flagged):**
- **The saved preferences are not applied yet.** Nothing in `src/modules/notifications/` reads them,
  so turning "Order updates" off still sends order notifications. Making the senders honour them
  needs a call on which events map to `live` / `bids` / `orders` / `messages` (messages has no
  backend at all). Suggested for Phase 6 (notifications), which touches those handlers anyway.
- **Push-token registration is backend only.** The app has no way to obtain a token: it needs
  `expo-notifications` (plus a dev build or Expo project id), which is outside `02-TRD.md` §1, so I
  did not add it. `api/preferences.ts` already has `registerDevice` / `removeDevice` ready; call
  them after sign-in and from sign-out once the package is approved. Web has no push token.
- Unauthenticated calls still return `{"message":"Unauthorized","statusCode":401}` instead of the
  error envelope (already listed for Phase 9; seen again here).
- `PreferencesProvider` still holds a `verified` / `setVerified` pair nothing uses (verification is
  real now). Left alone, tidy in Phase 9.
- No domain spec was added: there is no rule in this phase (defaults and a field-by-field patch),
  and domain tests are not allowed mocks beyond `Clock`. Behaviour is covered by the live scripts.

---

## Phase 3: Addresses and checkout (DONE, verified live, 12 Oct 2026)

**Backend** (all in `src/modules/identity/`; the address book belongs to the user, so it lives next
to preferences rather than in a new module):
- New Prisma model `UserAddress` (same seven fields as the order's address: `fullName`, `line1`,
  `line2?`, `city`, `region`, `postalCode`, `countryCode`, plus `isDefault`) and migration
  `20261012010000_user_addresses` (applied with `migrate deploy`, `migrate diff` shows no drift).
  **Not in the docs, added on the user's instruction.**
- `GET /v1/me/addresses` (default first, then oldest), `POST /v1/me/addresses` (201),
  `PATCH /v1/me/addresses/:id` (partial; `line2: null` clears it; `isDefault` can only be set to
  `true`, the default moves rather than being unset), `DELETE /v1/me/addresses/:id`. **Not in the
  spec.** Zod `.strict()` on every body; a missing or someone else's id is a 404 (generic
  `NOT_FOUND`).
- Rules (domain, with a spec, 4 tests): the first address is always the default; at most **10**
  addresses per user (`ADDRESS_LIMIT_REACHED`, 409, new code in the backend registry and the app's
  copy). **The 10 is a safety cap I chose, not a number from the docs: change
  `MAX_ADDRESSES_PER_USER` if you want another.**
- Every write that touches the default flag runs in one transaction; deleting the default promotes
  the oldest remaining address. No partial unique index (Prisma can't model one without drift), so
  "one default" is held by the transaction only.
- `POST /v1/orders/:id/address` was **not changed**. An order keeps its own copy of the address:
  editing or deleting a saved address never changes an order that used it (verified).
- Backend `tsc --noEmit` clean.

**App** (`frontend/src/`):
- `api/addresses.ts` (new), `setOrderAddress` in `api/orders.ts`, new error text for
  `ADDRESS_LIMIT_REACHED` / `NOT_FOUND` / `INVALID_ORDER_STATUS`.
- `components/commerce/AddressForm.tsx` (new, shared): one form for the address book and checkout,
  required-field checks, the server's reason shown on failure, US only (country is not a choice until
  D-004 is decided).
- `AddressesScreen` is real: list with default marker, add (with a "make default" switch), edit,
  make default, delete with a confirm step, loading / error / empty states.
- **New `OrderCheckout` screen** (route `order-checkout`) for a real order: pick a saved address or
  type a new one (saved to the book by default; the order is still updated if saving to the book
  fails), stored on the order via `POST /orders/:id/address`, then a review with the server's amounts
  and the address. `MyOrderDetail` now shows the real address and a "Checkout" / "Review checkout"
  button (waiting for payment) or "Change shipping address" (paid, before shipment). The review says
  plainly that paying by card is not connected yet.
- `PreferencesProvider` lost its mock address (`addresses` / `setAddresses`). Payments are still the
  mock until Phase 4. App `tsc --noEmit` clean.

**Verified live** (real API + Postgres + Redis, real app in headless Chrome):
- API script, 31/31: empty book; first address becomes the default; second does not; list order;
  default moves and stays unique; partial edit keeps other fields and clears `line2`; another user
  sees an empty book and gets 404 on edit/delete; 5 PATCH and 3 POST validation cases (400), no token
  401; deleting the default promotes the remaining one; create-with-default moves it; the 10 cap and
  the 11th refused with 409 `ADDRESS_LIMIT_REACHED`; against a **real order created by a real buy**:
  a saved address sets the order address (201), it can be changed before shipment, editing or
  deleting the saved address leaves the order's copy, another user gets 404, a bad country 400.
- Browser script, 19/19: empty state; add first (server holds it, default); blank street refused,
  nothing saved; add second as default; "Make default" moves it; edit changes only the city; full
  reload matches the server; order detail shows the real address and the checkout button; checkout
  lists saved addresses, choosing one stores it on the order (server); the review shows address,
  amounts and the payment note; a new address typed at checkout is stored on the order **and** added
  to the book; "Keep it" cancels a delete, "Delete" removes it on the server; the order keeps its copy.
  Screenshots looked right (after one spacing fix between address cards).

**Found, not fixed (flagged):**
- **The old mock `Checkout`** (route `checkout`, product ids, "Simulate payment failure", "Confirm
  mock purchase") is still reachable from mock entry points (`Live.tsx` mock streams, `Inbox`,
  `Conversation`, `OrderDetail`, `StateGallery`). Its address fields are now blank instead of the fake
  "Alex Morgan". It dies with those screens (streaming-blocked / Phase 9). The real flow is
  `OrderCheckout`.
- No delivery-method choice: the backend has no express shipping; `shippingAmount` is whatever the
  order was created with (0 on the fixture sales). Not invented.
- Countries: only US is offered; the backend accepts any ISO alpha-2 code. Waits on **D-004**.
- **Dev DB fixtures:** the old `sale_at_bad_*` / `sale_bid_b_*` sales fail on buy-now (500, rolled
  back): their products have no reservation or their seller has no application row (the known
  Phase 2 defect, left as is). For testing I created two healthy buy-now sales (`sale_p3_*`, product
  `prod_at_bad_1791275426868` with one reserved unit each). They left **two `PENDING_PAYMENT`
  orders** on `plain-buyer-test@example.com` (one holds a copied address "9 New Rd"); Phase 4 can use
  them. That account's address book was emptied again.
- Same unauthenticated-401-not-in-envelope item as before (Phase 9).
- The realtime server (3001) was restarted along with the API (Prisma's engine file is locked while
  either runs, so both had to stop for `prisma generate`).

---

## Phase 4: Payments (DONE, verified live, 12 Oct 2026)

**Backend** (`src/modules/payments/**`, plus `orders` for disputes):
- New Prisma model `PaymentCustomer` (user id to Stripe customer id) and migration
  `20261012020000_payment_customers`, applied, no drift. **Not in the docs** (the spec has no place
  for it; the port already flagged this gap). Cards themselves are **not stored**: they are read
  from Stripe every time. The customer is created lazily on the first setup-intent.
- The three documented card routes now exist (`05-API-SPEC.md` §9): `POST /v1/payments/setup-intent`
  (returns `clientSecret` plus the **publishable key**, an addition so the app needs no config;
  it is public by design), `GET /v1/payments/methods` (brand, last4, expiry), `DELETE
  /v1/payments/methods/:id` (404 unless the card is one of the caller's own).
- `POST /v1/orders/:id/pay` (already existed): now charges against the buyer's Stripe customer and
  **checks the card id belongs to the buyer** (404 otherwise), so another account's card id cannot be
  used. Without the customer Stripe refuses a saved card, so this was required, not optional.
- **Webhook** (`POST /webhooks/stripe`, was a stub that only marked events processed): the job now
  applies events through `ApplyProviderEventUseCase`, idempotent (each branch checks current state):
  `payment_intent.succeeded` (settle payment, mark order PAID, which publishes `order.paid.v1` so the
  ledger runs), `payment_intent.payment_failed` (FAILED with Stripe's code and message),
  `payment_intent.amount_capturable_updated` (a card that finished extra authentication such as
  3-D Secure outside the server: capture it, tolerant of the normal in-app path capturing first),
  `charge.refunded` and `charge.refund.updated` (refunds made in the Stripe dashboard or settling
  late: create/update `Refund` rows from Stripe's own list, set PARTIALLY_REFUNDED / REFUNDED, a full
  refund also moves the order, same rule as the in-app refund), `charge.dispute.created` (order to
  DISPUTED through a new `MarkOrderDisputedUseCase`, `order.disputed` OrderEvent, no domain event
  invented). Other event types are recorded and ignored.
- **Bug fixed in the existing webhook controller**: an invalid signature returned **500** (Stripe's
  error is not an HttpException, the old comment assumed Nest would turn it into a 4xx). It is now a
  400, nothing recorded, so junk requests don't look like server faults.
- Setup intents are created with redirects off (same as payment intents): confirm needs no
  `return_url`. `STRIPE_PUBLISHABLE_KEY` added to the env schema (required, `pk_`), `stripe.config`
  and `.env.example` (placeholder only). **Your real `.env` already had it.**
- Provider port gained `listRefunds`; payment repo `findByProviderIntentId/ChargeId`; refund repo
  `findByProviderRefundId/updateStatus`; order repo `markDisputed`.
- Backend `tsc --noEmit` clean, `depcruise` clean (no layer violations), 35 unit tests pass.

**App** (`frontend/src/`):
- `api/payments.ts` (new): list/delete cards, setup intent, `payOrder` with an `Idempotency-Key`
  generated **per press of Pay** (a retry after a decline needs a fresh key or the server replays the
  decline).
- **Adding a card uses Stripe's own card form (Stripe.js loaded from js.stripe.com by a script tag,
  no npm package added).** The card number is typed into Stripe's iframe and goes browser to Stripe;
  it never reaches our API or app code. `CardEntry.web.tsx` does this; **on phones `CardEntry.tsx`
  says adding a card isn't available yet**, because the native SDK (`@stripe/stripe-react-native`)
  is not in `02-TRD.md` §1 and I did not install it without your approval. Saved cards, listing,
  removing and paying with a saved card work on any platform.
- `PaymentsScreen` is real (list with brand/last4/expiry, add, remove with confirm). The mock card
  and `payments` / `setPayments` are gone from `PreferencesProvider`; the old mock `Checkout` now
  has its own fixed fake card list.
- `OrderCheckout` review now takes payment: radio list of saved cards (or the card form if none),
  "Pay $X", Stripe's decline message shown on failure, "needs extra verification" message for a card
  that wants 3-D Secure, success state, and a check of the order's real status if the answer is lost
  in transit. `MyOrderDetail` no longer says payment is unavailable ("Review and pay" button).
- App `tsc --noEmit` clean.

**Verified live** (real API, Postgres, Redis and the **real Stripe test mode**):
- API and webhook script, 47/47: setup-intent (secret + `pk_` key), customer created once and
  reused, a Visa saved and listed with expiry, another user sees none; paying with a card that
  isn't yours 404, another user's order 404, no Idempotency-Key refused, pay SUCCEEDED, order PAID,
  same key again returns the same result (one payment row, charge on the user's customer), a saved
  card that declines gives FAILED with Stripe's message and the order stays unpaid, retry with a good
  card (new key) PAID, card removal (other user 404, owner 200, again 404); webhooks signed with the
  real secret: bad signature 4xx, missing 400, nothing recorded; accepted events processed; a
  duplicate event id delivered twice is stored once; unknown type / unknown intent ignored; a real
  Stripe intent waiting for capture is **captured by the webhook**, order PAID and a **ledger
  transaction created**; the repeat is a no-op; `payment_failed` records code and message; a partial
  and then a full refund made directly at Stripe are picked up (Refund rows from Stripe's data,
  PARTIALLY_REFUNDED then REFUNDED, order REFUNDED); a dispute event moves the order to DISPUTED
  once, a second one changes nothing.
- Browser script, 16/16, with a **card typed into Stripe's real iframe**: empty state; Visa 4242
  saved (server lists it, list shows brand, last four, expiry); a second card (4000 0000 0000 0341,
  saves fine, declines when charged) saved; Stripe's own rejection of 4000 0000 0000 0002 shown in
  the form with nothing saved; order detail offers "Review and pay"; review lists both cards;
  paying with the declining card shows "Your card was declined." and **no order changes**; paying with
  the good card makes exactly one order PAID on the server, success screen, detail shows Paid;
  remove card (Keep it cancels, confirm removes on the server); reload matches the server.

**Found, not fixed (flagged):**
- **3-D Secure inside the app is not supported.** A card that needs authentication cannot be
  completed by the buyer in the app (that needs Stripe.js `handleCardAction` after the server's
  confirm, and a retry that tolerates an already-confirmed intent). The app says so. The webhook
  side is done: if the authentication is completed elsewhere, the capture and PAID happen. Needs a
  decision and a small second pass.
- **Phone card entry** needs `@stripe/stripe-react-native` (not in TRD §1, needs your approval and a
  dev build; also cannot be verified on web).
- **No default card** concept: Stripe's list order is used (newest first) and checkout preselects the
  first. A default needs storage or Stripe's customer default; not invented.
- **Dispute handling stops at the order status.** No ledger entries, no seller clawback, no hold on
  payouts, no `charge.dispute.closed` handling (win/lose). Refund ledger entries do not exist
  either (only `order.paid` is ledgered), so a refund moves the order and payment but not the books.
  Both need a ledger design (P7 territory) and a founder decision on dispute policy.
- The `Payment.providerFee` is still never filled (needs the balance transaction from Stripe).
- `charge.dispute.created` is looked up by charge id; `Payment.providerChargeId` has no unique
  index, so the first match is used (a payment has one charge, so this is fine today).
- The `CRITICAL ALERT: queue "streaming" had 15 failed jobs` lines in the API log are the known
  LiveKit placeholder credentials (D-005), unrelated to this phase.
- **Dev data:** test account `plain-buyer-test@example.com` now has a Stripe customer, one saved
  card (declining test card `4000 0000 0000 0341`) and several PAID/REFUNDED/DISPUTED orders from
  the scripts; about 6 `PENDING_PAYMENT` orders remain. The fabricated `Payment` rows I made for the
  webhook test were deleted. Nothing in a real Stripe account beyond test mode was touched.
- Python on this Windows machine writes files in the system code page unless told otherwise: one of
  my edits briefly corrupted a "·" in `Checkout.tsx` (repaired and re-checked). Use the Edit tool or
  an explicit `encoding="utf-8"` for anything with non-ASCII characters.

---

## Phase 5: Real time (DONE, verified live, 12 Oct 2026)

**Two real backend defects found and fixed first (without them nothing could be pushed):**
1. **`PubSubService` dropped every cross-process message in the API and realtime processes**
   (`src/platform/redis/pubsub.service.ts`). A WebSocket gateway's `afterInit` runs before Nest's
   `onModuleInit` hooks and subscribes through this service, which makes ioredis start connecting;
   `onModuleInit` then skipped the `status === 'wait'` block that attached the `message` listener.
   Redis counted the subscription, but every message was silently discarded. Symptom: sockets
   connected and joined rooms, yet an HTTP bid produced no `sale.updated` / `bid.outbid`. The
   listener is now attached once in the constructor.
2. **Fixing (1) alone made every handler run once per process** (`EventBusService`). Every process
   (api, realtime, worker) registers every handler, and the bus delivered each event to all of them,
   so one outbid created **2 notifications** (API handler plus the realtime process's copy). The same
   duplication already existed whenever a worker ran, hidden by (1) in the other two processes. The
   bus now has explicit semantics: **a handler runs in the process that published the event, once;
   cross-process delivery is opt-in** (`subscribe(name, handler, { crossProcess: true })`). Only the
   two Socket.IO gateways (`SalesGateway`, `ChatGateway`) opt in, because the sockets live in the
   realtime process while bids, sales and chat deletes are published from the API and worker.
   Verified: one outbid now creates exactly 1 notification. 6 new unit tests
   (`event-bus.service.spec.ts`). Backend `tsc` and `depcruise` clean, 113 unit tests pass.

**App** (`frontend/src/`):
- **Dependency added, flagged:** `socket.io-client@^4.8` (the client half of Socket.IO 4, which
  `02-TRD.md` §1 lists; the admin portal already uses the same version). Nothing else.
- `realtime/realtime-url.ts`: the realtime server is a separate process on port 3001.
  `EXPO_PUBLIC_REALTIME_URL` if set, otherwise the API host on port 3001 (so a phone that reaches the
  API on the computer's LAN address reaches realtime there too).
- `providers/RealtimeProvider.tsx` + `hooks/useRealtime.ts`: one Socket.IO connection while signed
  in, token in the handshake and re-read on every reconnect attempt (a failed handshake triggers one
  authenticated request, which refreshes an expired token), `on(event)` listeners, counted
  `joinRoom(sessionId)` that re-joins after a reconnect, `status`, `joinedRooms`, and a
  `connectionEpoch` that goes up on every (re)connect so screens refetch their snapshot (events sent
  while down are gone).
- `realtime/sale-events.ts` (pure, 8 unit tests in `tests/sale-events.test.ts`): how `sale.updated`,
  `sale.extended`, `sale.resolved`, `sale.cancelled`, `bid.outbid` and `offer.responded` change the
  sale on screen; payloads are validated, a late event never moves an auction price backwards, a
  finished sale never reopens.
- `SaleActions` (the product page's bid / buy / offer panel): reads the sale once, joins the stream's
  room, applies the events above, shows **"Current bid · Live"**, **"You're the highest bidder."**
  and **"You were outbid. The current bid is $X."**, and shows the seller's response to an offer.
  The old 3 second poll is now only a **fallback while the socket or the stream's room is not
  available**, and a slow snapshot never overwrites a newer pushed price. Bids, buy now and offers
  stay HTTP calls (exact rejection reasons; the spec keeps the HTTP routes for reliability).
- `MyBidsList`: re-reads when `bid.accepted` / `bid.outbid` arrive, so Leading / Outbid flips live.
- `App.tsx` mounts `RealtimeProvider` inside `AuthProvider`.

**Verified live** (real API, Postgres, Redis, real realtime server, real app in headless Chrome):
- Socket script, 13/13: connect with a token (a bad token does not stay connected); `room.join`
  answers `room.state`; an HTTP bid produces `sale.updated` for the whole room (15-35 ms) and
  `bid.accepted` for the bidder only; a rival's bid produces `bid.outbid` for the previous leader
  only; `sale.updated` carries only `saleId, currentAmount, endsAt, bidCount` (no user ids); a
  too-low bid is still `BID_TOO_LOW` over HTTP; after `room.leave` no more room events.
- Browser, 12/12 on the final code, two users (the browser user and a rival bidding over the API):
  the screen shows **Live**; a rival's bid appears in **~30 ms** (the poll would take up to 3 s);
  my own bid shows "You're the highest bidder"; the rival outbids and "You were outbid... $15.00"
  appears in **~0.4 s** with the leader message gone; **Bids & Offers** flips Outbid / Leading /
  Outbid live (~0.4 s); a bid inside the last 10 s **extends the countdown on screen by itself**;
  another buyer buys a buy-now item and the page flips to "Sold for $15.00" (~0.5 s) without a reload.
- Browser, reconnect scenario, 7/7 (run twice): the realtime server is **killed while the app is
  open** and the "Live" marker disappears; the fallback poll still brings in a rival's bid; the server
  comes back, the app **reconnects on its own**, is Live again, and a push arrives in ~0.4 s.
- Frontend tests 24/24 (8 new), app `tsc` clean.

**Found, not fixed (flagged):**
- **`sale.resolved` carries `winnerUserId` to the whole room** (the spec says `winnerName`; the
  gateway has a documented gap and sends the id). The app uses it to say "You won this one", but it
  also tells every viewer who won, by internal user id. `GET /sales/:id` still exposes the same fields
  (known, Phase 9). Needs a display-name field instead of the id.
- **No name on the leader**: `sale.updated` has no `leaderName` (spec field); the app only knows if
  *I* am the leader, which is all it needs.
- **The winner is not told they won while off the page**: `sale.resolved` goes to the room only, and
  an auction closing (the close job) sends nothing to the winner's own channel. The in-app inbox and
  order status push are Phase 6.
- **The countdown uses the phone's clock** against the server's `endsAt` (no `serverNow` offset is
  applied). A wrong device clock shows a wrong countdown; the server decides anyway.
- **A stream that is not LIVE cannot be joined** (`room.join` is refused), so a sale in a stream that
  ended is kept fresh by the fallback poll only (the screen says nothing about "Live" then).
- Chat, viewer counts, `stream.ended`, `viewers.count` and `chat.*` events are not wired: the app
  has no chat or video yet (streaming is excluded).
- `EXPO_PUBLIC_REALTIME_URL` / the derived `:3001` URL: **a phone also needs Windows to allow
  inbound port 3001** (same firewall rule as 3000, `prompt.md` §10) and the dev server restarted.
- Metro (the Expo dev server) did not see the newly installed package until restarted with a cleared
  cache (`npx expo start --web --port 8081 -c`); a plain hot reload showed a blank page.
- Dev data: several `sale_rt_*` fixture sales (auctions and buy-nows in LIVE sessions) and bids on
  them for `plain-buyer-test@example.com` and `p1-1791702038@example.com`; older open sales of the
  same products were set to CANCELLED by the fixture script.

---

## Phase 6: Notifications and order lifecycle (DONE, verified live, 12 Oct 2026)

Three backend facts confirmed before writing any code (per the user's "flag gaps, don't invent"
instruction this phase): `NotificationDelivery` existed (P8-04) with no read route and no
read/unread state at all; `05-API-SPEC.md` §8 documents `POST /orders/:id/cancel` for
**seller/admin only**, and it wasn't built for *anyone* (no use case existed); the WS catalogue
(`06-REALTIME-AND-CONCURRENCY.md` §2) has no order or notification events. Three decisions were put
to the user rather than guessed (AskUserQuestion) — all three "recommended" options were chosen:
add a `readAt` field plus read routes, add a buyer-scoped cancel narrower than the documented
seller/admin one, and add minimal new per-user WS events rather than fall back to polling.

**Backend:**
- **Notifications** (`src/modules/notifications/`): new nullable `readAt` column on
  `NotificationDelivery` (migration `20261012030000_notification_read_state`). `GET
  /v1/me/notifications` (cursor-paginated, **filtered to `channel='EMAIL'` only** — `notify()` fans
  one logical event out to one EMAIL delivery plus one PUSH delivery per device, and EMAIL is the
  only channel guaranteed exactly once per user per event, so listing every channel would show each
  notification duplicated per device) returns `{items, nextCursor, unreadCount}`. `POST
  /v1/me/notifications/:id/read` (idempotent, someone else's id is a 404). **Not in
  05-API-SPEC.md**, same "user-directed addition" precedent as change-password/preferences/
  addresses. New `notification.created` domain event, published only for the EMAIL delivery, carried
  by a new `NotificationsGateway` to the recipient's `user:{userId}` WS channel (the same per-user
  channel `SalesGateway`/`StreamingGateway` already use, joined at connect — no new join logic
  needed anywhere).
- **Orders cancel** (`src/modules/orders/`): new `CancelOrderUseCase`, **buyer-scoped,
  `PENDING_PAYMENT` only** — narrower than the spec's seller/admin version (`PENDING_PAYMENT` or
  `PAID`), which still isn't built. Reuses the documented `POST /orders/:id/cancel` path rather than
  inventing a second one; a future seller/admin cancel should branch on role at this same route. New
  `order.cancelled` domain event. `cancelledAt`/`cancelReason` columns already existed on `Order`
  (unused until now) — no migration needed.
- **Orders live status** (`src/modules/orders/api/ws/orders.gateway.ts`, new): subscribes to the
  four order domain events that exist today (`order.paid`, `order.shipped`, `order.delivered`, the
  new `order.cancelled`) and translates each into one `order.status.changed` WS event on the buyer's
  `user:{userId}` channel. Refund/dispute are **not** included — neither publishes a domain event
  today (by design, per those use cases' own comments: no event name is documented for either), and
  adding one is P7/ledger territory, not this phase.
- Backend `tsc --noEmit` clean. 28 live checks (real API, Postgres, Redis, realtime server, a real
  Socket.IO client) all passed: inbox list shape, no-token 401, mark-read on a missing/foreign id
  404; cancel success (status, `cancelReason`, `cancelledAt`), re-cancel 409
  `INVALID_ORDER_STATUS`, cancel a `PAID` order 409, cancel someone else's order 404, no-token 401;
  a real `ship` call produces both a WS `order.status.changed` (`SHIPPED`) **and** a WS
  `notification.created` within ~1s; a real `confirm-delivery` call produces `order.status.changed`
  (`DELIVERED`); the inbox then lists the `order.shipped` notification unread, mark-read flips it,
  a second mark-read is a no-op, a fresh `GET` shows it read, another user gets 404 marking it.

**App** (`frontend/src/`):
- `api/notifications.ts` (new): `listNotifications`, `markNotificationRead`,
  `notificationText()` (title/body from the EMAIL delivery's rendered content). `api/orders.ts`:
  `cancelOrder`, `confirmDelivery`, `cancelReason` added to `OrderView`.
- `providers/NotificationsProvider.tsx` + `hooks/useNotifications.ts` (new): owns only the
  **unread count** for the tab-bar badge — loaded after sign-in, bumped the instant a
  `notification.created` WS push arrives, dropped when the inbox marks something read. The
  notification list itself is fetched by the Inbox screen directly (same pattern `MyOrders` uses for
  orders), not held in the provider.
- `Inbox.tsx`: the **Activity tab is real now** (was the mock `activity` array) — lists real
  notifications newest-first, unread ones bold with a red dot, tapping marks read (optimistic, with
  the provider's unread count) and navigates to Orders for `order.*`/`sale.resolved` templateKeys.
  The **Messages tab is still mock** (DMs are Phase 8, needs a founder decision on scope, untouched).
- `MainTabNavigator.tsx`: **fixed a known logic bug** — the Inbox tab's red dot was unconditional
  (`t.name === ROUTES.INBOX`), now gated on `unreadCount > 0` from the provider.
- `MyOrderDetail.tsx`: **Cancel** section (two-step confirm, same "Keep it" / danger-button pattern
  `AddressesScreen` already uses for delete) shown only when `PENDING_PAYMENT`; **Confirm delivery**
  button (new — this action existed on the backend since Phase 1 but was never in the app) shown
  only when `SHIPPED`; the cancel reason is shown on a cancelled order. Subscribes to
  `order.status.changed` for this exact order id and refetches live (a seller shipping while this
  screen is open updates without a reload).
- `MyOrders.tsx`: subscribes to `order.status.changed` and patches the matching row's status in
  place (same "patch, don't reload" choice `SaleActions` makes for `sale.updated`).
- App `tsc --noEmit` clean (`NODE_OPTIONS=--max-old-space-size=8192`). Expo web bundle compiles
  clean (613 modules, no errors).

**Verified live in the real app** (real API/Postgres/Redis/realtime, Brave via the Claude in Chrome
extension — the extension wasn't connected at the start of this session; the user installed and
connected it mid-session so this pass could run against the already-running servers):
- Inbox > Activity: real notification history rendered (a real "You've been outbid" history from
  Phase 5 testing, each correctly bold/dotted if unread), the order-shipped item showed read
  (marked by the verification script) while a sibling stayed unread; tapping an unread item cleared
  its dot at once; **a full page reload confirmed the read state persisted on the server**, not just
  local optimistic state.
- Tab-bar dot: present while unread items remained (no longer unconditional), and **ticked up live**
  the moment an order was shipped from a separate `curl` call while the app sat open — proof the
  `notification.created` WS push reaches a real running app, not just the test socket script.
- Order cancel: opened a real `PENDING_PAYMENT` order, "Cancel order" → confirm step → "Cancel
  order" → status flipped to Cancelled with a "Order cancelled." toast, Cancel section gone.
- Order status live push on a real screen: shipped a different order via `curl` as its seller while
  sitting on the Purchases **list** screen — the row patched from "Paid" to "Shipped" with no reload,
  exactly as `MyOrders.tsx`'s realtime subscription is supposed to do.
- Confirm delivery: opened the now-Shipped order, "Confirm delivery" → status flipped to Delivered
  with a "Delivery confirmed." toast, the button correctly disappeared.
- No console errors across the whole pass.

**Found, not fixed (flagged):**
- **Notification tap navigation is shallow**: `order.*`/`sale.resolved` templateKeys navigate to the
  Orders **list**, not the specific order — the rendered notification content only ever stores
  `{title, body}` (or `{subject, body}`), not the originating `orderId`/`saleId`, so there's nothing
  to deep-link to without a data-shape change. Not invented; flagged instead.
- **The saved notification preferences still aren't honoured** (the Phase 2 gap persists) — this
  phase added a way to *read* notification history, not a way to *suppress* categories the user
  turned off. Still needs the `live`/`bids`/`orders`/`messages` → event mapping flagged since
  Phase 2.
- **Refund/dispute have no live push or inbox entry** — by design this phase (see above); those two
  transitions publish no domain event today at all, backend or app.
- Same unauthenticated-401-not-in-envelope item as every prior phase (Phase 9).
- **Dev data**: the verification script cancelled one `PENDING_PAYMENT` order and shipped+delivered
  one `PAID` order for `plain-buyer-test@example.com` (via real `ship`/`confirm-delivery` calls, not
  DB writes); the browser pass cancelled one more `PENDING_PAYMENT` order and shipped+delivered one
  more `PAID` order the same way. Two fixture sellers'
  (`bidseller-1791270461276@example.com`, `atseller-1791275426868@example.com`) passwords were reset
  to `VerifyPhase6!2026` via the real forgot/reset-password flow (same technique Phase 1's
  verification used) so `ship` could be called as a real authenticated seller — no DB password
  writes, no other accounts touched.

---

## Phase 7: Seller side (DONE, verified live, 12 Oct 2026)

Backend survey first, per this project's own discipline. Turned out most of the seller backend
**already existed** from the original 65-ticket build: application/bank-account/profile routes
(`POST/GET /seller/application`, `/submit`, `/withdraw`, `POST /seller/bank-account`, `GET/PATCH
/seller/profile`), full product CRUD (`POST/GET/PATCH/DELETE /v1/products`), and seller orders +
ship (`GET /seller/orders`, `POST /orders/:id/ship`, built in the original P6 tickets). The real
backend gap was narrow but real: **no seller-facing balance/ledger/payouts route existed at all**
(`GET /seller/balance`, `/seller/ledger`, `/seller/payouts`, `/seller/payouts/:id` — all documented
in `05-API-SPEC.md` §10, none built; `GetPayoutStatementQuery` existed with no route and no
ownership check, same "logic lands before its HTTP ticket" pattern as payments in earlier phases).
On the app side, the gap was total: **no screen anywhere checked the real `Seller.status`** — any
signed-in buyer saw the full seller hub UI (SellHub) regardless of whether they had ever applied.

**Backend:**
- **Ledger** (`src/modules/ledger/`): new `SellerLedgerEntry` read-model (a `LedgerEntry` enriched
  with its transaction's type/reference and its account's type — the raw entity alone carries
  neither), new repository method `findEntriesForSeller` (joins through `LedgerAccount` for the 3
  seller-owned account types). New `LedgerService.getBalanceForUser`/`listEntriesForUser`, both
  resolving the caller's own seller id the same way `ShipOrderUseCase` always has (`SellersService`
  injected into `LedgerService` for the first time). New `SellerLedgerController`:
  `GET /v1/seller/balance` (zeros, not an error, for a seller with no ledger activity yet — no
  `SellerBalance` row exists until the first post), `GET /v1/seller/ledger` (cursor-paginated).
  **`nextPayoutDate` from the spec's own example response is deliberately not returned** — no
  scheduler/cron exists anywhere in this codebase (payout runs are admin-triggered manually only),
  so there's no real date to compute. Flagged, not invented.
- **Payouts** (`src/modules/payouts/`): new repository method `findBySeller` (status optional,
  unlike admin's `findByStatus` where it's required — a seller's own history has a natural "all"
  view). New `ListMyPayoutsQuery` (same ownership-resolution pattern). `PayoutsService.getMyStatement`
  adds the ownership check `GetPayoutStatementQuery` was missing — a seller reading someone else's
  payout id gets `PAYOUT_NOT_FOUND` (masked, not `FORBIDDEN`), same precedent as every other
  ownership check in this build. New `SellerPayoutsController`: `GET /v1/seller/payouts`,
  `GET /v1/seller/payouts/:id`. `payouts.module.ts` now imports `SellersModule` for the first time.
- Backend `tsc --noEmit` clean. 29 live checks, all passing: a brand-new buyer registered and ran
  the **entire real lifecycle** — no application (404) → save draft → blocked from creating
  products (403 `SELLER_NOT_APPROVED`, both before and after submitting) → submit → admin approves
  (real `POST /admin/seller-applications/:id/approve`) → bank account saved (`last4` matches) →
  profile updated → category fetched → product created (DRAFT, **confirmed no `price` field in the
  response**) → listed, updated, archived (another user editing it masked as not-approved/no-profile)
  → balance/ledger/payouts all correctly empty/zero for a seller with no activity yet → every route
  401s with no token → the pre-existing fixture seller's balance (`$13.50` available, from Phase 6's
  real delivered order) still reads correctly, a regression check.

**App** (`frontend/src/`):
- `api/{seller,seller-products,seller-orders,seller-finance}.ts` (new): full typed client for
  application/bank-account/profile, catalog-scoped product CRUD, seller orders + ship, and
  balance/ledger/payouts. **Two real response-shape corrections made during verification, not
  assumed upfront**: `createProduct`/`updateProduct` return only `{productId, status}` /
  `{productId}`, never the full product (matches `CreateProductUseCase`/`UpdateProductUseCase`'s
  actual result types — the app doesn't need the full object back since it just navigates away with
  a toast). `SellerProduct` has no `images` field: the seller-scoped `/products` routes return the
  plain `Product` aggregate, which doesn't carry images (only the public `/catalog/products/:id`
  response does, via a separate enrichment query) — confirmed by reading the actual entity, not
  invented.
- **`SellHub.tsx` now gates the whole Sell tab on the real `Seller.status`** (the headline fix this
  phase makes): `getMySeller()` on mount, and only an `APPROVED` seller sees the real hub — every
  other state (never applied, `DRAFT`, `PENDING_REVIEW`, `REJECTED`, `SUSPENDED`) renders the new
  `SellerApply` screen's own status view instead. The approved hub's "Available balance" tile and
  inventory preview are **real** (`getBalance()`, `listMyProducts()`), replacing the old fake "Sales
  / Orders this month" numbers entirely rather than leaving them to look real. "Go live" and
  "Schedule show" stay the simulated preview they always were — unchanged, still blocked on
  streaming (D-005).
- `SellerApply.tsx` (new): the application form (type, legal name, display name — the three real
  `Seller` columns; `formData` has no documented shape, sent empty, document upload excluded, needs
  storage) for `DRAFT`/no-seller, and a read-only status card with a withdraw action for
  `PENDING_REVIEW`, a rejection-reason message for `REJECTED`, a plain notice for `SUSPENDED`.
- `SellerBankAccount.tsx` (new): add/replace bank details. **Flagged: no GET route exists anywhere**
  to read a saved bank account back — only `last4` is returned once, right after a save — so this
  screen can confirm what was just saved but can't show "current bank: ····1234" after a reload.
- `SellerProfileEdit.tsx` (new): display name only (05-API-SPEC.md says "display name, bio" — no
  `bio` column exists on `Seller`, same gap the backend DTO's own comment already flagged).
- `Inventory.tsx`/`Listing.tsx` (rewritten, real): catalog-only fields (title, category, condition,
  description, quantity, weight) — **no price, no listing type, no photo, no "publish" action**.
  Neither the create nor update DTO accepts a `status`, so a product simply stays `DRAFT` until it's
  put up in a real sale; the screen says plainly "Pricing and auction/buy-now setup happen when you
  put this up in a live show" rather than faking a publish button. This was a real structural
  mismatch with the old mock screen (which had price, starting price, and an Auction/Buy Now
  picker) — put to the user directly before building (AskUserQuestion), who chose catalog-only CRUD.
- `SellerOrders.tsx` (new): the seller's order queue with status tabs; a `Ship` button (inline
  carrier/tracking form) appears only on `PAID` orders, reusing the already-thoroughly-verified
  `POST /orders/:id/ship` from Phase 6 (WS push and all) rather than re-inventing that path.
- `PayoutsScreen.tsx` (rewritten, real): real balance tile (available/pending/paid out) and real
  payout history; tapping a payout expands its statement (orders covered) inline. No
  `nextPayoutDate` shown, matching the backend's own honest omission.
- `Dashboard.tsx`: **fixed a real routing bug** — "Orders" sent a seller to their own buyer purchase
  history (`ROUTES.ORDERS`, `MyOrders`) instead of their seller order queue; now routes to the new
  `SELLER_ORDERS`. Added Bank account / Seller profile menu rows. The stat-card grid and weekly
  chart stay mock (no seller analytics endpoint exists anywhere) — now explicitly flagged in the UI
  itself ("No seller analytics endpoint exists yet — the numbers below are a mock preview, not real
  data"), not just the chart's pre-existing "Mock sales distribution" caption.
- App `tsc --noEmit` clean (`NODE_OPTIONS=--max-old-space-size=8192`).

**Verified live in the real app** (real API/Postgres/Redis, Brave via the Claude in Chrome
extension): a genuine non-seller buyer (`plain-buyer-test@example.com`) opened the Sell tab and saw
the real apply form (not the old unconditional hub); filled it in and submitted — status flipped to
"Under review" with the real legal/display name and type shown (a transient blank-looking screenshot
mid-transition was double-checked against `document.body.innerText` and the server's own data, both
correct — a rendering-timing artifact of the automation, not a real bug); approved via a real admin
API call; reloaded and saw the real approved hub (`$0` balance, empty inventory, no fake stats);
created a real catalog listing end-to-end (toast, appears in inventory as `DRAFT`); saved bank
details (toast, `····7665` shown, confirmed via a fresh `GET /seller/profile`... — no, confirmed via
the dedicated save-response check since no GET exists, see the flagged gap above); edited and saved
the seller display name (confirmed via a direct API re-fetch afterward, not just the toast); the
seller dashboard showed the new mock-data disclosure and the fixed menu routing. Switched to the
pre-existing fixture seller (`bidseller-1791270461276@example.com`, real order/ledger history from
Phase 6) to check the data-rich paths: the hub's inventory preview and balance tile showed real
existing listings and the real `$13.50` balance (displayed as `$14` — `formatUSD`'s pre-existing
whole-dollar-only formatting, used everywhere in this app already, not a new issue); the Orders
screen listed all 3 real orders with correct statuses, amounts, and tracking info, with the Ship
button correctly absent on non-`PAID` orders; Payouts showed the real balance tile and a correct,
honest "No payouts yet" empty state. No console errors across the whole pass.

**Found, not fixed (flagged):**
- **No GET route for a saved bank account** — `SellerBankAccountRepositoryPort` almost certainly has
  a find method internally, but nothing exposes it over HTTP. The app can confirm a save, never show
  "what's on file" after a reload.
- **No seller analytics endpoint exists anywhere** — the dashboard's stat cards and weekly chart
  stay mock, now explicitly disclosed in the UI rather than just implied by the existing chart
  caption.
- **REJECTED has no resubmit path** — `seller-status-transition.rule.ts`'s own transition table has
  no outbound edge from `REJECTED` (a deliberate, pre-existing design from the original build, same
  "terminal until a doc says otherwise" treatment as other terminal statuses). A rejected applicant
  is genuinely stuck in this app; not this phase's call to invent a new transition.
- **Document upload is entirely out of scope** — needs S3/storage (excluded from this whole
  integration task, same as avatar upload in Phase 1). The backend routes
  (`POST /seller/documents/upload-url`, `POST /seller/documents`) exist and are untouched; nothing
  in the app calls them.
- **Product has no price, ever, outside a Sale** — confirmed structurally, not just assumed: neither
  `CreateProductSchema` nor `UpdateProductSchema` accepts one, and no route moves a product's status
  from `DRAFT`. A product only becomes sellable when a real `Sale` is created against it, which
  needs a stream session — still fully blocked on streaming (D-005). "Go live"/"Schedule show" stay
  mock, unchanged.
- **The ship action wasn't re-exercised live for a brand-new order this phase** — `POST
  /orders/:id/ship` and its WS push were already thoroughly verified in Phase 6 (API script + real
  browser + a live WS listener); this phase confirmed `SellerOrders.tsx`'s list rendering and its
  conditional Ship-button visibility (correctly absent on non-`PAID` orders) instead of manufacturing
  a fresh `PAID` order fixture just to re-click an already-proven path.
- Same unauthenticated-401-not-in-envelope item as every prior phase (Phase 9).
- **Dev data**: a brand-new seller account `verify-phase7-<timestamp>@example.com` /
  `VerifyPhase7!2026` was created by the verification script (full real lifecycle: applied,
  approved, bank account, profile, one archived product) and left in the dev DB. The same lifecycle
  was repeated once more live in the browser as `plain-buyer-test@example.com`, who is now a real
  **approved** seller named "Pat's Finds Co" with one `DRAFT` product ("Vintage Camera") and bank
  details on file (`····7665`) — this account's seller status has changed from earlier phases'
  buyer-only fixtures, worth knowing if a later session reuses it. `bidseller-1791270461276@example.com`
  (password still `VerifyPhase6!2026` from Phase 6) gained one more `DRAFT` product ("Debug Product")
  from a manual curl check during this phase's debugging.

---

## Phase 8: Reviews, messages, help (DONE, verified live, 13 Oct 2026)

No founder decision had come back on the open questions raised at the start of this phase (order
vs. product vs. seller review target, DM scope, static vs. backend-driven help). The user asked
for recommendations and a full build instead of waiting further, plus explicit admin control over
reviews and reports. Recommendations made and built (flagged, not a founder-relayed decision):

- **Reviews are order-scoped**: one review per order (`orderId` unique), only once the order is
  `DELIVERED`/`COMPLETED`, aggregated up to a seller rating. Star (1-5) + optional text. Buyer can
  edit/delete their own anytime (no edit window in the docs to enforce). Seller gets one public
  response per review. Admin can hide/unhide (soft, preserves the review) with a reason — hard
  delete was deliberately not added for reviews, unlike messages (see below).
- **Messages are buyer-initiated DMs, one conversation per (buyer, seller) pair**, not per-order —
  covers "ask a seller a question before buying," which the founder's own words described and
  which has no order yet. A seller can only reply within an existing thread, never cold-start one
  (flagged scope choice). Text only (no attachments — storage stays out of scope). Real-time via
  the existing per-user WS channel pattern (`message.created`), same shape as
  `notification.created`/`order.status.changed`.
- **Help is admin-authored content** (`HelpArticle`: category, title, body, sortOrder,
  isPublished), not hardcoded in the app — so staff can edit FAQ copy without an app release.
  Public `GET /v1/help/articles` returns published only.
- **A generic `Report` model** (targetType `REVIEW`|`MESSAGE`, reason, status) backs the admin
  moderation the user asked for: any authenticated user can flag a review or message
  (`POST /v1/reports`), admin lists/resolves the queue with a preview of the target. Deliberately
  standalone (no FK, no cross-module import) so `reports` never has to import `reviews`/
  `messaging` back — the preview is assembled in `AdminController`, not `ReportsService`, which
  would otherwise create a circular module dependency (both of those modules call into reports to
  create a report).

**Backend** (four new modules: `src/modules/reviews/`, `messaging/`, `help/`, `reports/`, each
following the standard domain/application/infra/api layering; none of this is in
`05-API-SPEC.md`/`03-DATA-MODEL.md`, confirmed again before building):
- New Prisma models `Review`, `Conversation`, `Message`, `HelpArticle`, `Report` + enums
  (`ReviewStatus`, `ReportTargetType`, `ReportStatus`), migration
  `20261013072323_reviews_messaging_help_reports`, applied, no drift.
- New error codes `REVIEW_ALREADY_EXISTS` (409), `ORDER_NOT_REVIEWABLE` (409),
  `SELLER_CANNOT_MESSAGE_SELF` (409); conversation/message/review/report "not found" cases reuse
  the generic `NOT_FOUND` code, same precedent as `DeviceNotFoundError`.
- Buyer/seller routes: `GET`/`POST /v1/orders/:id/review`, `PATCH`/`DELETE /v1/reviews/:id`,
  `POST /v1/reviews/:id/respond`, `GET /v1/sellers/:sellerId/reviews` (public); `GET`/
  `POST /v1/me/conversations`, `GET`/`POST /v1/me/conversations/:id/messages`,
  `POST /v1/me/conversations/:id/read`; `GET /v1/help/articles` (public); `POST /v1/reports`.
- Admin routes (all in `AdminController`, same direct-service-injection shape as `sellers`/`chat`):
  `GET /admin/reviews`, `POST /admin/reviews/:id/hide`, `POST /admin/reviews/:id/unhide`,
  `POST /admin/messages/:id/delete` (hard delete, mirrors the existing
  `chat/messages/:id/delete` precedent exactly), `GET`/`POST /admin/help/articles`,
  `PATCH /admin/help/articles/:id`, `POST /admin/help/articles/:id/delete`, `GET /admin/reports`,
  `POST /admin/reports/:id/resolve`. Every admin action writes an `AuditLog` row, same as every
  other admin mutation.
- `CreateReviewUseCase` resolves order ownership/status through `OrdersService` (not a direct
  repository read), per this project's cross-module rule. `RespondToReviewUseCase`/messaging's
  membership checks resolve the caller's seller id through `SellersService.getMySeller`/
  `getSellerById`, same pattern `LedgerService`/`PayoutsService` already use.
- Backend `tsc --noEmit` clean.

**App** (`frontend/src/`):
- `api/reviews.ts`, `api/messaging.ts`, `api/help.ts` (new). New error messages for the three new
  codes in `describe-error.ts`.
- `MyOrderDetail.tsx`: a "Your review" section on `DELIVERED`/`COMPLETED` orders — a 5-star picker
  (new `StarPicker`), optional text, submit/edit, shows the seller's response once posted.
- `ReviewsScreen.tsx` (rewritten, real): the **seller's own received reviews** (reached from the
  Sell tab's dashboard menu, unchanged route) — real rating summary, real reviews, a "Respond"
  action per review. Was an in-memory mock before.
- `SellerProfile.tsx`: new "Reviews" tab (public listing + rating in the header) and a "Message"
  button next to Follow/Unfollow, navigating to `Conversation` with the seller id.
- `Conversation.tsx` (rewritten, real): now keyed by **seller id**, not a conversation id (no
  "get conversation by seller" route exists, so it finds-or-starts the thread itself — same
  page-walk `api/channels.ts`'s `isFollowing()` already uses for an equivalent lookup). Live
  updates via `message.created`. Was an in-memory mock before.
- `Inbox.tsx`'s Messages tab is real now (was the mock `messages`/`sellers` array) — real
  conversations, unread bold + dot, navigates by seller id.
- `MessagingProvider`/`useMessaging` (new, mirrors `NotificationsProvider` exactly): owns the
  unread-conversation count, bumped live on `message.created`. `MainTabNavigator`'s Inbox tab dot
  now combines unread notifications **and** unread messages.
- `HelpScreen.tsx` (rewritten, real): real published articles grouped by category, tap to expand.
  The old mock "Submit demo request" form is gone — it never sent anywhere.
- Deleted now-fully-unused mock data: `data/messages.ts`, `data/reviews.ts`, `types/message.ts`,
  and the `conversationMessages` export from `data/chat.ts` (its `liveComments` export, used by
  the stream chat overlay, is untouched).
- App `tsc --noEmit` clean (`NODE_OPTIONS=--max-old-space-size=8192`).

**Admin portal** (`admin-portal/src/`): three new pages wired into the existing sidebar/router,
same shape as every other phase's page (`Section`, shared button/input styles, cursor-paginated
list + status filter chips) —
- **Reviews**: status filter, hide (with a required reason) / unhide.
- **Reports**: status filter (defaults to Open), each row shows a preview of the reported review
  or message; "Remove message" (hard delete + auto-resolve) for `MESSAGE` reports, "Mark
  resolved"/"Dismiss" for either type.
- **Help content**: create form, publish/unpublish toggle, delete, grouped by category.

**Verified live** (real API, Postgres, Redis, realtime server; a throwaway script,
`verify-phase8.ts`, deleted after the run): 36/36 checks — review create/duplicate-rejected
(409)/not-reviewable-rejected (409)/rating-out-of-range (400)/edit/no-token (401); public seller
review listing with correct summary; seller `respond` (the right seller found by elimination
between two fixture accounts, confirmed membership masking); admin hide/unhide and the public
listing excluding a hidden review; conversation start, idempotent re-start (same conversation id),
seller sees it unread, seller reply, buyer sees all 3 messages, a non-participant gets a masked
404, mark-read, empty-body rejected (400); report create, admin sees it with a review preview,
resolve, re-resolving an already-resolved report 404s; admin message delete and the thread
reflecting it; help article create, unpublish, public list excludes unpublished, admin list
includes both, delete, and the public route still works with no token at all.

**Full real-browser pass** (Claude in Chrome, both apps): mobile app — left a 4-star review with
text on a real delivered order (persisted across reload), the Inbox Messages tab showed a real
conversation with the real seller display name, sent a new message and saw it appear immediately,
opened a brand-new seller's profile and saw the real "Message"/"Reviews" UI (empty state
correctly), switched to the seller account and saw the real review on the Sell tab's "Your
reviews" screen, posted a seller response that persisted; the Help screen showed a real (then
empty, since no articles were authored) state, not the old mock form. Admin portal — Reviews page
showed the real review with its seller response and a working Hide button; Reports page showed
the dismissed test report (its preview correctly empty, since that review had since been deleted
by the verify script — not a bug); Help content page: created, published, and deleted a real
article live.

**Found, not fixed (flagged):**
- **A conversation's denormalized `lastMessageAt`/`lastMessageBody` preview does not update when
  the admin hard-deletes that most-recent message** — the thread itself correctly drops the
  deleted message, but the Inbox list's preview text stays stale until the next real message is
  sent. Found live during the browser pass (the admin-moderation verify script had deleted the
  seller's reply). Cosmetic, not data-corrupting; would need the delete path to also recompute the
  conversation's preview from the new last message.
- **No help content has been authored yet.** The public Help screen is genuinely empty until an
  admin adds real articles via the new admin-portal page or API — nothing was invented to fill it.
- **Report creation does not validate that the target id actually exists** — deliberate, to keep
  `ReportsModule` standalone (see above); an admin opens a report for a since-deleted target and
  sees an empty preview, same as a dangling reference, not a crash.
- Seller search in the mobile app's Discover screen did not match "Atomic" against a seller whose
  display name is "Atomic Seller" during manual testing — found incidentally while browser-testing
  this phase, pre-existing and unrelated to Phase 8 (the search indexes channel name/slug, not the
  seller's display name); not investigated further, flagged for whenever search itself is revisited.
- Same unauthenticated-401-not-in-envelope item as every prior phase (Phase 9).
- **Dev data**: a real review (4 stars, with a seller response) was left on order
  `01M4N072VDZFZWXX0WE7MGHSHF` (`sel_at_1791275426868`) from the browser pass; a real DM thread
  between `plain-buyer-test@example.com` and `atseller-1791275426868@example.com` was left with a
  few test messages (one deleted by the admin-moderation check); one `DISMISSED` test report
  remains for audit-trail realism. The admin portal's Vite dev server (port 5173) was started this
  session to verify the three new pages and was left running, unlike most prior phases where it
  wasn't needed.

---

## Phase 9: Hardening (DONE, verified live, 13 Oct 2026)

**Backend:**
- **`GET /v1/sales/:id` no longer leaks an internal user id to the public** — flagged since Phase 5.
  The raw domain `Sale` was returned as-is before (no mapper, no guard at all), exposing
  `winnerUserId`, `orderId` and `version` to anyone. Surveyed real usage first rather than
  blanket-copying the public list's exclusion: `orderId`/`version` are read nowhere in the app, so
  they're dropped entirely, same as `GET /sales` already does; `currentBidId`/`finalAmount` are
  genuinely needed by the product page (leading-bid check, "Sold for $X" shown to every viewer
  already) and neither identifies a person on its own, so both stay. `winnerUserId` is the one
  real identity leak and the one field the app actually needs back **only for the winner
  themselves** (`iWon = winnerUserId === myId` is the app's own existing check) — new
  `toSaleDetailView(sale, viewerUserId)` returns the real id only when the caller's own id matches
  it, `null` otherwise, for anyone else including other bidders, the seller, and signed-out
  visitors. New `OptionalJwtGuard` (`src/platform/auth/optional-jwt.guard.ts`) backs this: attaches
  `request.user` when a valid bearer token is present, same as `JwtGuard`, but never rejects the
  request when one is missing or invalid — matches 05-API-SPEC.md §7's own "optional" auth
  annotation for this route, which nothing implemented before. No frontend change was needed: the
  response shape is unchanged, only the value behind `winnerUserId` differs per viewer.
- **The 401-not-in-envelope bug flagged in every integration phase since Phase 2 is fixed.**
  `JwtGuard` threw Nest's bare `UnauthorizedException()`, whose default body
  (`{statusCode,message,error}`) is not this project's `{error:{code,message,details}}` envelope —
  `GlobalExceptionFilter` passed it through unchanged since it's still an `HttpException`, just the
  wrong shape. New `UnauthenticatedHttpException`/`ForbiddenHttpException`
  (`src/shared/errors/guard.exception.ts`, same "plain `HttpException` subtype thrown directly by a
  guard" placement as `IdempotencyKeyRequiredException`/`RateLimitedHttpException`) carry the real
  `UNAUTHENTICATED`/`FORBIDDEN` codes. **Found adjacent while fixing the flagged 401 case and fixed
  in the same pass**: `RolesGuard` had the identical bug for 403s (`ForbiddenException()`, same bare
  body) — not separately flagged anywhere, but the same root cause sitting two files away, so
  leaving it would have made this hardening pass visibly incomplete.
- Backend `tsc --noEmit` clean, 113 unit tests pass.

**App** (`frontend/src/`): no changes needed for the sale-detail/401/403 fixes (shapes unchanged,
only values). Cleanup only:
- Deleted three genuinely dead screens, confirmed unreferenced anywhere (`screens/personal/`):
  `Orders.tsx`/`OrderDetail.tsx` (superseded by the real `MyOrders`/`MyOrderDetail` since Phase 1,
  flagged as dead code back then, never removed until now) and `StateGallery.tsx` (the dev
  component gallery, "Preview states" — its menu row removed from `SettingsScreen.tsx`, its route
  removed from `ProfileNavigator.tsx` and `constants/routes.ts`).
- Removed `PreferencesProvider`'s unused `verified`/`setVerified` pair (flagged "tidy in Phase 9"
  back in the Phase 2 write-up — verification is real now, nothing read this leftover state).
- Swept the whole `screens/` tree for any other now-unreferenced file; none found.
- App `tsc --noEmit` clean (`NODE_OPTIONS=--max-old-space-size=8192`). All 24 frontend unit tests
  pass (`npm test`).

**Verified live** (real API, Postgres, Redis, realtime server):
- `curl` checks: a bad bearer token and no token both now return
  `{"error":{"code":"UNAUTHENTICATED",...}}`; a signed-in non-admin hitting an admin route returns
  `{"error":{"code":"FORBIDDEN",...}}`. `GET /sales/:id` on a real resolved sale: anonymous and a
  different signed-in buyer both get `winnerUserId:null`, no `orderId`/`version` in the response at
  all; the actual winning buyer, authenticated, gets their own id back. `GET /sales` (the list)
  confirmed unchanged — same field set as before.
- Browser pass (Claude in Chrome, real app): Settings no longer shows "Preview states"; the real
  Bids & Offers list still correctly shows Leading/Outbid/Won/Lost (reads `currentBidId`/
  `winnerUserId` from the now-trimmed `GET /sales/:id` response, confirming the fix didn't regress
  it); a real product page loaded a real open sale (price, countdown, bid panel) with no console
  errors.

**Found, not fixed (flagged, out of this phase's scope):** everything already carried forward from
Phases 1-8 that wasn't "hardening" — push token registration, notification preferences not yet
honoured by senders, in-app 3-D Secure, phone card entry, the documented seller/admin order cancel,
no GET route for a saved seller bank account, no seller analytics endpoint, the Phase 8 conversation
-preview staleness on admin message delete, no help content authored yet, chat/viewer counts, and
everything blocked on streaming (D-005) or storage. None of these were in Phase 9's scope
(`GET /sales/:id`, the 401/403 envelope, and dead-code removal) and weren't touched.

**This closes all 9 integration phases.** The mobile app is now fully wired to the backend except
streaming and storage, exactly as the user's original instruction for this task asked.
