# Architecture

**Last updated:** 2026-09-29

---

## 1. Shape: modular monolith, three deployables

One codebase. One dependency graph. Three process entry points that can scale independently.

```
                    ┌──────────────────────────────┐
   Mobile app ─────▶│  api        (HTTP, stateless)│
                    ├──────────────────────────────┤
   Mobile app ─────▶│  realtime   (WebSocket)      │
                    ├──────────────────────────────┤
   cron/queue ─────▶│  worker     (BullMQ jobs)    │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────┴───────────────┐
                    │  PostgreSQL   │   Redis      │
                    └──────────────────────────────┘
```

**Why not microservices:** a small team shipping fast cannot afford distributed transactions across auctions, orders and ledger. Modules are bounded contexts with explicit boundaries, so extraction later is mechanical rather than a rewrite.

**Why three processes:** a slow HTTP request must never delay a bid broadcast, and a heavy payout batch must never block either. Separate processes, shared code.

---

## 2. Bounded contexts (modules)

| Module | Owns | Never touches directly |
|---|---|---|
| `identity` | Users, credentials, sessions, roles, devices | Anything else |
| `sellers` | Applications, documents, verification state, seller profile | Payments, orders |
| `catalog` | Products, variants, categories, inventory levels | Sales, orders |
| `channels` | Seller channels, follows, channel settings | Streaming internals |
| `streaming` | Live sessions, video provider tokens, viewer presence | Sales logic |
| `chat` | Messages, moderation actions, mutes, bans | Sales logic |
| `sales` | **The sale engine.** Auctions, buy now, offers, bids, winners | Payments, ledger |
| `orders` | Order lifecycle, shipping, tracking, delivery confirmation | Ledger internals |
| `payments` | Payment intents, captures, refunds, chargebacks, processor webhooks | Ledger internals |
| `ledger` | Double-entry accounts, entries, balances | Everything else |
| `payouts` | Payout runs, batching, transfers, statements | Order internals |
| `notifications` | Push, email, in-app, templates, delivery tracking | Anything else |
| `admin` | Admin-only read models and actions across modules | Writes go via module services |

### Communication rules

1. **Within a request:** modules call each other only through a module's public `*.service.ts` facade, never repository to repository.
2. **Across boundaries where eventual consistency is fine:** publish a domain event. The consumer subscribes.
3. **Never** import another module's entities, Prisma delegates, or internal helpers.

```
sales ──event: SaleResolved──▶ orders ──event: OrderPaid──▶ ledger
                                  │
                                  └──event: OrderDelivered──▶ ledger (release)
```

---

## 3. The critical path: a bid

This is the hottest path in the system. Everything else can be slower.

```
1. Client sends  bid.place  over WebSocket
2. realtime process: authenticate socket, rate limit (Redis token bucket)
3. Enqueue into the auction's serialized handler
4. Postgres transaction:
     SELECT ... FOR UPDATE on auction row
     validate: open? amount >= current + increment? bidder eligible?
     INSERT bid, UPDATE auction.current_amount, maybe extend ends_at
     COMMIT
5. Publish  bid.accepted  to Redis pub/sub channel  room:{id}
6. All realtime nodes subscribed to that room fan out to their sockets
7. Loser receives  bid.rejected  on their socket only
```

**Why Postgres row lock rather than a Redis Lua script:** the bid ledger must be durable and auditable. Realistic per-auction bid rates (5 to 50/s) are well inside what a short `FOR UPDATE` transaction handles. Redis stays the fanout and rate-limit layer, not the source of truth. Revisit only if a single auction exceeds ~200 bids/s.

Full detail in `06-REALTIME-AND-CONCURRENCY.md`.

---

## 4. Video path

Video never passes through our backend.

```
Seller phone ──▶ Video provider ingest ──▶ CDN edge ──▶ Viewer phones
                        ▲
                        │ token issued by
                  streaming module
```

Our responsibilities:
- Issue short-lived publish tokens to approved sellers
- Issue subscribe tokens to viewers
- Track session lifecycle via provider webhooks (`stream.started`, `stream.ended`)
- Record session metadata: duration, peak viewers, items sold

Provider is abstracted behind `StreamProviderPort`. Swapping LiveKit for IVS touches one adapter file.

---

## 5. Money architecture

```
Buyer card
    │
    ▼
Payment processor (charge only)
    │
    ▼
Company bank account  ◀── all funds settle here
    │
    ▼
┌─────────────────────────────────────────┐
│ Internal ledger (append-only, double    │
│ entry, minor units, idempotent)         │
│                                         │
│  platform_cash    seller_pending        │
│  platform_revenue seller_available      │
│  processor_fees   seller_paid_out       │
└─────────────────────────────────────────┘
    │
    ▼
Payout run ──▶ transfers ──▶ seller bank
```

**Invariants that must never break:**
- Every ledger entry has a matching counter-entry. Debits equal credits, always.
- Entries are append only. Corrections are new reversing entries, never edits.
- Every money operation carries an idempotency key. Replays are no-ops.
- All amounts are integers in minor units (cents). No floats anywhere.
- A seller's balance is derived from entries, never stored as a mutable field that can drift. A cached projection is allowed and must be rebuildable from entries.

Full detail in `03-DATA-MODEL.md` section 8.

---

## 6. Data stores

| Store | Purpose |
|---|---|
| **PostgreSQL 16** | Source of truth for everything. Auctions, bids, orders, ledger. |
| **Redis 7** | Pub/sub fanout, socket presence, rate limits, BullMQ backing, short-lived caches |
| **S3 + CloudFront** | Product images, seller documents (private bucket, signed URLs), stream thumbnails |

Seller documents go in a **separate private bucket** with its own IAM policy, server-side encryption, access logging and a retention rule. They are never served through the public CDN.

---

## 7. Background jobs (BullMQ queues)

| Queue | Jobs |
|---|---|
| `auction` | `auction.close` scheduled at `ends_at`, rescheduled on extension |
| `payment` | `payment.capture`, `payment.retry`, `payment.reconcile` |
| `ledger` | `ledger.release` on delivery, `ledger.reconcile` nightly |
| `payout` | `payout.run`, `payout.transfer`, `payout.statement` |
| `notification` | `notify.push`, `notify.email` |
| `media` | `media.process` thumbnails, image resize |
| `stream` | `stream.reconcile` catch orphaned sessions |

Every job is **idempotent** and keyed. A job running twice must produce the same result as running once.

---

## 8. Cross-cutting

| Concern | Choice |
|---|---|
| Config | Zod-validated env schema, fails fast at boot |
| Logging | Pino, JSON, request id + user id + room id on every line |
| Errors | Typed domain errors mapped to HTTP/WS codes at the edge |
| Validation | Zod schemas at every boundary, inferred TS types |
| Auth | JWT access (15m) + rotating refresh (30d), argon2id hashes |
| Authorization | Role and policy guards. Seller actions check approval state. |
| Idempotency | `Idempotency-Key` header on all mutating money endpoints |
| Tracing | OpenTelemetry, trace id propagated into WS and jobs |
| Rate limiting | Redis token bucket, per user and per IP, tighter on bids and chat |

---

## 9. Deployment

- Docker image per process, same base, different `CMD`
- Managed Postgres with automated backups and PITR
- Managed Redis with persistence enabled
- Containers behind a load balancer, autoscaled on CPU and connection count
- Realtime nodes need sticky sessions or the Redis adapter (we use the adapter, so any node can serve any socket)
- Migrations run as a pre-deploy step, never at boot

---

## 10. Scaling path

| Trigger | Action |
|---|---|
| Realtime CPU high | Add realtime nodes. Redis adapter makes this transparent. |
| Postgres read pressure | Add read replicas, route catalog and discovery reads there |
| One auction exceeds 200 bids/s | Move that auction's state to a Redis Lua hot path with write-behind |
| Ledger table growth | Partition by month, archive cold partitions |
| A module becomes a bottleneck | Extract to its own service. Boundaries already exist. |
