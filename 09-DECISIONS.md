# Decisions and Open Items

**Last updated:** 2026-09-29

Architecture decision records, plus items still blocked on the founder.

---

## Open items (blocked on founder)

| ID        | Item                                                                                                                               | Blocks                                  | Status                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------- |
| **D-001** | Legal cover for holding and transmitting funds: money transmitter licensing, KYC/AML programme, 1099-K reporting, seller agreement | P7 going live                           | **Open**                              |
| **D-002** | Company accounts created in the business name: bank, Stripe, AWS, domain                                                           | P6, P7, deployment                      | **Open**                              |
| **D-003** | Commission rate (flat basis points)                                                                                                | Default 1000 bps in place, configurable | **Open, not blocking**                |
| **D-004** | Launch countries and currencies                                                                                                    | Affects payout rails and tax            | **Open, not blocking v1 build**       |
| **D-005** | Video provider: LiveKit Cloud vs Amazon IVS                                                                                        | P4-02                                   | **Resolved 14 Oct 2026 — Amazon IVS** |

**D-001 is the only item that can stop launch.** The system will be built to whatever the legal advisers specify, but the ledger and payout design assumes the platform is legally able to hold funds. If that answer changes to "use Stripe Connect after all", P7 shrinks considerably and the ledger becomes a mirror rather than the source of truth. Ask early.

---

## ADR-001 — Modular monolith, not microservices

**Status:** accepted

**Context:** live commerce spans auctions, orders, payments and a ledger. These are transactionally coupled: a resolved sale must create exactly one order and exactly one balanced ledger transaction.

**Decision:** one codebase with enforced module boundaries, deployed as three processes (api, realtime, worker).

**Consequences:**

- Good: single transaction across order and ledger, one deploy, no distributed tracing archaeology to debug a missing payout
- Good: boundaries already exist, so extraction later is mechanical
- Bad: one bad deploy affects everything. Mitigated by separate processes and feature flags.

**Revisit when:** one module's scaling profile clearly diverges (most likely `realtime`, already a separate process).

---

## ADR-002 — NestJS over bare Fastify

**Status:** accepted

**Context:** a large codebase built partly by AI agents. The dominant failure mode is an agent losing track of where things belong and producing sprawl.

**Decision:** NestJS with the Fastify adapter.

**Consequences:**

- Good: modules map one to one onto bounded contexts; DI makes ports and adapters natural; agents have an unambiguous place to put everything
- Good: Fastify adapter keeps throughput close to bare Fastify
- Bad: more boilerplate and a heavier boot than bare Fastify

---

## ADR-003 — Postgres row locking for bid concurrency, not Redis Lua

**Status:** accepted

**Context:** simultaneous bids must produce exactly one winner, with a durable, auditable bid record.

**Decision:** serialize per-auction bids with `SELECT ... FOR UPDATE` inside a short transaction. Redis handles fanout and rate limiting only.

**Rationale:**

- A lost bid is a lost sale and an unresolvable dispute. Durability beats raw throughput here.
- Realistic load (5 to 50 bids/s per auction) is comfortably within a short row-locked transaction.
- A Lua hot path would need write-behind, a recovery path and reconciliation. That is a lot of machinery for throughput we do not have yet.

**Consequences:**

- Good: simple, correct, auditable
- Bad: a ceiling around 200 bids/s on a single auction

**Revisit when:** any single auction sustains over 150 bids/s. Then move that auction's live state to Redis Lua with a durable write-behind stream. Measured, not guessed.

---

## ADR-004 — Money as BigInt minor units

**Status:** accepted

**Decision:** all monetary amounts are `BigInt` in the currency's minor unit. Never float, never `number`, never a decimal library in application code.

**Consequences:**

- Good: exact arithmetic, no accumulated drift across thousands of ledger entries
- Bad: serialization needs care (`BigInt` is not JSON native). API layer converts to a JSON number only when the value is safely within range, otherwise a string. Decided per endpoint in `05-API-SPEC.md`.

---

## ADR-005 — Double-entry, append-only ledger

**Status:** accepted

**Context:** the platform holds other people's money. Every cent must be explainable.

**Decision:** double-entry ledger. Entries are append only. Corrections are reversing entries, never edits. Balances are projections rebuildable from entries.

**Consequences:**

- Good: any balance at any point in time is reconstructible
- Good: nightly reconciliation can prove correctness rather than assume it
- Bad: more write volume and more code than a single `balance` column
- Bad: developers must understand debits and credits. `02-TRD.md` and `03-DATA-MODEL.md` §10 carry the worked examples.

---

## ADR-006 — Video never transits our backend

**Status:** accepted

**Decision:** the video provider handles ingest and delivery. Our backend issues tokens and tracks session lifecycle through webhooks.

**Consequences:**

- Good: bandwidth and transcoding cost and complexity sit with a specialist
- Good: swapping providers is one adapter file
- Bad: we depend on provider uptime during live shows. Mitigated by the `stream.reconcile` job and a documented runbook.

---

## ADR-007 — Sale data and video data travel on separate paths

**Status:** accepted

**Context:** video carries 2 to 5 seconds of latency. Bidding cannot.

**Decision:** the video stream comes from the provider. Prices, timers, bids and chat come over our WebSocket. The client composes them.

**Consequences:**

- Good: bids are instant regardless of video latency
- Bad: what a viewer sees on screen lags slightly behind the sale state. The client should render the current item from our data, not from the video, so the two never disagree about what is being sold.

---

## ADR-008 — Anti-snipe extends from `now`, not from `endsAt`

**Status:** accepted

**Decision:** on a late bid, `newEndsAt = now + extendBySeconds`, with a maximum extension count.

**Rationale:** extending from the previous `endsAt` lets extensions stack, so an auction can drift far beyond what the seller intended. Extending from `now` gives every late bidder the same fixed response window.

---

## ADR-009 — Auction closing: scheduled job plus sweeper

**Status:** accepted

**Decision:** a BullMQ delayed job per auction, rescheduled on extension, backed by a 10 second sweeper that closes anything past `endsAt` still marked `OPEN`.

**Rationale:** a dropped Redis job must never leave an auction open forever. The sweeper is cheap insurance and its query is indexed.

---

## ADR-010 — Seller documents in a separate private bucket

**Status:** accepted

**Decision:** identity documents live in their own S3 bucket with its own IAM policy, SSE-KMS, access logging and a retention rule. Never behind the public CDN. Admin access is via 60 second signed URLs, and every access writes an audit log entry.

**Rationale:** verification is in house, so the platform carries the responsibility for this data. Blast radius is contained by separating it from public media entirely.

---

## ADR-011 — Refund/dispute money: clawback from held balances, fees in the books

**Status:** accepted (founder decision over WhatsApp, 19 Oct 2026; materialized by the ledger-hardening sub-phase 3b the same day)

**Decision:** when a buyer is refunded — in-app or from the Stripe dashboard — the buyer always gets the refund in full, and the money comes out of what the seller still holds with us first (`SELLER_PENDING`, then `SELLER_AVAILABLE`), recovered from future sales second: anything neither account holds posts as a negative `SELLER_PENDING` projection, which the seller's next sale automatically nets back toward zero. The platform never silently covers the gap. Stripe processor fees are recorded in the books as the `PROCESSOR_FEES` debit / `PLATFORM_CASH` credit pair on every paid order, which is what lets the ledger's cash match Stripe's fee-net wallet exactly. Refund postings split proportionally (`floor(commission × R / G)` reversed from revenue, remainder from the seller) and are idempotent on `refund.recorded:<providerRefundId>`.

**Rationale:** payouts are excluded from scope (D-001/D-002) and not immediate, so a seller's money is virtually always still held with us — the clawback branch covers nearly every real case today. The "future sales" recovery is representable with zero new schema (the `SELLER_PENDING` projection simply goes negative), which is why no `SELLER_DEBT` account type or debt column was invented; a separate debt account becomes worth building only when real payouts can empty seller balances. Disputes need no separate posting path: a lost dispute's refund is a Stripe refund on the charge, flowing through the same reconciliation and refund-recorded posting as any dashboard refund; a won dispute moves no money. The one residual: whether the production Stripe webhook endpoint is subscribed to `charge.refunded` / `charge.refund.updated` / `charge.dispute.created` is a Stripe-dashboard setting, not code — verify it once in the dashboard, since the code accepts all of these.

---

## ADR-012 — hls.js for web stream playback, native player untouched

**Status:** accepted

**Decision:** `frontend/src/components/live/ReelVideo.web.tsx` is a web-only override of `ReelVideo.tsx` that plays Amazon IVS's `.m3u8` playback URL through `hls.js` (MediaSource Extensions) when `Hls.isSupported()` is true, and falls back to the browser's native `<video src>` HLS support when it isn't (Safari only — `Hls.isSupported()` is false there because MSE-based HLS isn't needed). Native iOS/Android keep using `expo-video` unchanged.

**Rationale:** founder-reported (26 Oct 2026): the web live stream renders a blank frame no matter how stable OBS is. Root cause: `expo-video`'s web implementation sets the IVS HLS URL directly as a `<video src>`, and only Safari parses HLS natively in `<video>` — Chrome, Edge, and Firefox have none, so the stream silently fails to play with no error surfaced. This reproduces on every non-Safari browser regardless of OBS reconnect behavior, which is a different (and likely primary) cause from the Phase-1 IVS-reconnect-tolerance fix (`live-issues-progress.md`) that was the leading hypothesis before this was traced through the actual web player code.

---

## Deferred decisions

| Item                                       | Defer until                                |
| ------------------------------------------ | ------------------------------------------ |
| Multi-currency                             | D-004 answered and a second market is real |
| Read replicas                              | Postgres read load actually shows pressure |
| Ledger table partitioning                  | Entry count approaches 50 million          |
| Extracting `realtime` into its own service | Realtime scaling diverges from API scaling |
| Seller reputation and ratings              | Post launch, needs real transaction volume |
| In-app shipping labels                     | Post launch, needs seller demand data      |
