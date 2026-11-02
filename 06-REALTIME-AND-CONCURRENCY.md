# Realtime and Concurrency

**Last updated:** 2026-09-29

This is where the product lives or dies. Read this before touching `modules/sales` or `modules/chat`.

---

## 1. Connection model

One WebSocket per client, multiplexed across rooms via Socket.IO rooms.

```
Client connects  ──▶  ws://.../socket  with access token in auth payload
                      │
                      ├─ WsAuthGuard verifies JWT, attaches userId to socket
                      ├─ socket joins  user:{userId}   (personal channel)
                      │
Client emits room.join { sessionId }
                      ├─ verify session is LIVE
                      ├─ verify user is not banned from the channel
                      ├─ socket joins  room:{sessionId}
                      ├─ add to Redis presence set, start heartbeat
                      └─ emit room.state (snapshot: current sale, price, timer, recent chat)
```

**Every client gets a snapshot on join.** Never make the client reconstruct state from a stream of deltas it partially missed.

---

## 2. Event catalogue

### Inbound (client to server)

| Event          | Payload                           | Rate limit     |
| -------------- | --------------------------------- | -------------- |
| `room.join`    | `{ sessionId }`                   | 10/min         |
| `room.leave`   | `{ sessionId }`                   | 20/min         |
| `bid.place`    | `{ saleId, amount, clientRef }`   | 5/sec per user |
| `buy.now`      | `{ saleId, quantity, clientRef }` | 3/sec per user |
| `offer.submit` | `{ saleId, amount, clientRef }`   | 2/sec per user |
| `chat.send`    | `{ sessionId, body, clientRef }`  | 3/sec per user |
| `heartbeat`    | `{ sessionId }`                   | every 15s      |

`clientRef` is a client-generated id echoed back in the ack, so the app can match a response to its own optimistic UI without guessing.

### Outbound (server to room)

| Event                | Payload                                                   | Scope                                                                                                                                       |
| -------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `room.state`         | full snapshot                                             | joining socket only                                                                                                                         |
| `sale.opened`        | `{ sale }`                                                | room                                                                                                                                        |
| `sale.updated`       | `{ saleId, currentAmount, endsAt, bidCount, leaderName }` | room                                                                                                                                        |
| `sale.extended`      | `{ saleId, endsAt, extensionCount }`                      | room                                                                                                                                        |
| `sale.resolved`      | `{ saleId, winnerUserId, winnerName, finalAmount }`       | room                                                                                                                                        |
| `sale.cancelled`     | `{ saleId, reason }`                                      | room                                                                                                                                        |
| `sale.mode-switched` | `{ saleId, mode, currentAmount, price, endsAt }`          | room — added 14 Oct 2026, founder_requests.md §1 (not in the original catalogue; mode can now change on an open sale, not just at creation) |
| `bid.accepted`       | `{ saleId, bidId, amount, clientRef }`                    | bidder only                                                                                                                                 |
| `bid.rejected`       | `{ saleId, code, minimumNext, clientRef }`                | bidder only                                                                                                                                 |
| `bid.outbid`         | `{ saleId, newAmount }`                                   | previous leader only                                                                                                                        |
| `offer.received`     | `{ offer }`                                               | seller only                                                                                                                                 |
| `offer.responded`    | `{ offerId, status, counterAmount }`                      | offering buyer only                                                                                                                         |
| `chat.message`       | `{ message }`                                             | room                                                                                                                                        |
| `chat.deleted`       | `{ messageId }`                                           | room                                                                                                                                        |
| `viewers.count`      | `{ count }`                                               | room, throttled to 1/sec                                                                                                                    |
| `stream.ended`       | `{ sessionId }`                                           | room                                                                                                                                        |

**Rule:** room-wide events carry only what the UI needs to render. Never broadcast a full entity with private fields.

---

## 3. Fanout across nodes

Multiple realtime processes. A bid accepted on node A must reach viewers connected to node B.

```
node A: bid accepted
   │
   ├─ io.to('room:123').emit('sale.updated', payload)
   │     │
   │     └─ @socket.io/redis-adapter publishes to Redis
   │              │
   │              ├─▶ node B receives, emits to its local sockets in room:123
   │              └─▶ node C receives, emits to its local sockets in room:123
```

Use `@socket.io/redis-adapter`. Do not hand-roll pub/sub fanout for socket delivery. Do use the platform `PubSubService` for non-socket cross-process signals (for example telling the worker a sale resolved).

---

## 4. Bid concurrency — the core problem

Thousands of viewers, several bids landing in the same millisecond. Requirements:

1. Exactly one bid can be the leader at any moment
2. No two bids may accept the same amount
3. The bid sequence must be strictly ordered and auditable
4. A bid after `endsAt` must be rejected
5. A bid within the anti-snipe window must extend the timer atomically with its acceptance

### The chosen approach: serialized Postgres transaction

```ts
// modules/sales/application/commands/place-bid.usecase.ts  (shape, not final code)

async execute(cmd: PlaceBidCommand): Promise<Result<BidAccepted, BidRejected>> {
  return this.tx.run(async (trx) => {
    // 1. Lock the sale row. Concurrent bids on the SAME sale queue here.
    //    Bids on OTHER sales are unaffected.
    const sale = await trx.$queryRaw`
      SELECT * FROM "Sale" WHERE id = ${cmd.saleId} FOR UPDATE
    `;

    // 2. Pure domain validation, no I/O
    const decision = AuctionEntity.from(sale).evaluateBid({
      amount: cmd.amount,
      bidderId: cmd.userId,
      now: this.clock.now(),
    });
    if (decision.isRejected) return Err(decision.reason);

    // 3. Persist bid + new sale state in the same transaction
    const sequence = sale.bidCount + 1;
    const bid = await trx.bid.create({ ... sequence ... });

    const endsAt = decision.shouldExtend
      ? decision.newEndsAt
      : sale.endsAt;

    await trx.sale.update({
      where: { id: sale.id },
      data: {
        currentAmount: cmd.amount,
        currentBidId: bid.id,
        endsAt,
        extensionCount: decision.shouldExtend ? sale.extensionCount + 1 : sale.extensionCount,
        version: { increment: 1 },
      },
    });

    return Ok({ bid, sale, extended: decision.shouldExtend, previousLeaderId: sale.currentBidderId });
  });
  // 4. AFTER commit: reschedule close job, publish fanout
}
```

### Why row locking rather than Redis Lua

| Consideration                | Verdict                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Durability of the bid record | Postgres wins. A lost bid is a lost sale and a support ticket.                 |
| Throughput needed            | 50 bids/s on one auction is comfortable for a short `FOR UPDATE` transaction   |
| Complexity                   | One transaction versus a Lua script plus write-behind plus a recovery path     |
| Auditability                 | Bids are the evidence in a dispute. They belong in the database at write time. |

**Scale escape hatch:** if a single auction ever exceeds ~200 bids/s, move that auction's live state into a Redis Lua hot path with a durable write-behind stream. Do not build this preemptively. Ticket `SALES-14` covers the measurement that would trigger it.

### Critical ordering rule

```
Transaction commits  ──▶  THEN reschedule the close job  ──▶  THEN publish fanout
```

Never publish before commit. A rolled-back transaction that already broadcast `sale.updated` puts every client into a wrong state with no correction path.

---

## 5. Anti-snipe

Pure domain rule, zero I/O, in `modules/sales/domain/rules/anti-snipe.rule.ts`.

```
given: now, endsAt, extensionCount
config: windowSeconds (default 10), extendBySeconds (default 10), maxExtensions (default 20)

if (endsAt - now) <= windowSeconds AND extensionCount < maxExtensions:
    newEndsAt = now + extendBySeconds
    shouldExtend = true
```

Notice `newEndsAt` is computed from **now**, not from the old `endsAt`. Otherwise late bids stack extensions and an auction never ends.

`maxExtensions` prevents an infinite auction from two bidders trading increments forever.

---

## 6. Auction closing

Two mechanisms, belt and braces.

**Primary: scheduled BullMQ job**

```
When a sale opens      → enqueue auction.close at endsAt, jobId = `close:${saleId}`
When a sale extends    → remove the old job, enqueue at the new endsAt, same jobId
When the job runs      → attempt close
```

**Backup: sweeper**

```
Every 10 seconds, worker queries:
  SELECT id FROM "Sale" WHERE status = 'OPEN' AND "endsAt" < now() LIMIT 100
and enqueues close for anything the scheduler missed.
```

The sweeper exists because a dropped Redis job must not leave an auction open forever.

**The close operation must be idempotent:**

```ts
// guard at the top of close-auction.usecase.ts
const sale = await lockSale(saleId);
if (sale.status !== 'OPEN') return AlreadyClosed; // no-op, not an error
```

**Close sequence:**

1. Lock the sale row
2. If status is not `OPEN`, return (idempotent no-op)
3. Set status to `CLOSING`
4. If no bids: status `EXPIRED`, release product reservation, emit `sale.cancelled`
5. If bids: winner is the highest accepted bid
6. Publish `sale.resolved.v1` domain event
7. `orders` module consumes the event and creates the order
8. Emit `sale.resolved` to the room

Steps 6 to 8 are outside the lock. Holding a lock across order creation and payment would serialize everything.

---

## 7. Buy now concurrency

Stock is the contended resource, not the price.

```sql
UPDATE "Product"
SET reserved = reserved + $qty
WHERE id = $productId
  AND quantity - reserved >= $qty
RETURNING *;
```

Zero rows returned means someone else took the last unit. Reject with `OUT_OF_STOCK`. This is a single atomic statement, no lock needed, no read-then-write race.

Reservation is released when the sale resolves into an order (converted to sold) or when it cancels (returned to stock).

---

## 8. Presence and viewer counts

Redis only. Never write viewer churn to Postgres.

```
Key:  room:{sessionId}:viewers   (sorted set, score = last heartbeat epoch ms)

join       → ZADD room:123:viewers <now> <userId>
heartbeat  → ZADD room:123:viewers <now> <userId>   (every 15s from client)
count      → ZCOUNT room:123:viewers (now - 45000) +inf
reaper     → every 30s: ZREMRANGEBYSCORE room:123:viewers -inf (now - 45000)
```

Broadcast `viewers.count` at most once per second per room, and only when the number actually changed. Otherwise a busy room floods every client with noise.

Peak viewers is written to `StreamSession.peakViewers` when the stream ends, not continuously.

---

## 9. Chat throughput

- Rate limit 3 messages/sec per user via Redis token bucket
- Write to Postgres asynchronously via a queue. The broadcast does not wait on the insert.
- Keep the last 50 messages in a Redis capped list per room for instant `room.state` snapshots
- Banned and muted users are checked against a Redis set, refreshed on ban changes

Chat is the one place where losing a message is acceptable. Bids are not.

---

## 10. Reconnection

The client will drop. Design for it.

```
Client reconnects with lastEventId (optional)
  → server re-authenticates
  → server rejoins rooms the client names
  → server sends fresh room.state snapshot
```

Do not attempt to replay a missed event log. A snapshot is simpler, smaller and always correct.

The mobile team needs to know: **treat the snapshot as authoritative and discard local optimistic state on reconnect.**

---

## 11. Failure behaviour

| Failure                        | Behaviour                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Redis down                     | Sockets keep working per node, cross-node fanout stops. Bids still persist correctly. Alert immediately. |
| Postgres down                  | Reject bids with a clear error. Never accept a bid you cannot record.                                    |
| Close job fails                | Retries with backoff. Sweeper catches it. Alert after 3 failures.                                        |
| Stream provider webhook missed | `stream.reconcile` job polls provider state every minute for sessions marked LIVE.                       |
| Client clock skew              | Server is authoritative for timers. Send `endsAt` plus `serverNow` so the client can compute an offset.  |

---

## 12. Load test targets (`test/load/`)

Must pass on staging before going live with real money:

| Scenario                                             | Target                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| 5,000 viewers in one room, 20 bids/s                 | p95 bid to fanout under 300ms, zero lost bids                |
| 200 concurrent rooms, 100 viewers each               | Stable memory, no connection drops                           |
| 100 chat msg/s in one room                           | No backpressure, no dropped broadcasts                       |
| Simultaneous bid burst: 50 bids same ms, same amount | Exactly one accepted, 49 rejected with correct `minimumNext` |
| Node restart under load                              | Clients reconnect within 5s, state correct after snapshot    |
