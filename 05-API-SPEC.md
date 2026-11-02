# API Specification

**Last updated:** 2026-09-29

Base path: `/v1`. All responses JSON. All timestamps ISO 8601 UTC. All money returned as integer minor units plus a `currency` field.

WebSocket events are specified in `06-REALTIME-AND-CONCURRENCY.md` §2.

---

## 1. Conventions

### Response envelope

```jsonc
// success
{ "data": { ... }, "meta": { "requestId": "01J..." } }

// list
{ "data": { "items": [ ... ], "nextCursor": "01J..." }, "meta": { "requestId": "01J..." } }

// error
{ "error": { "code": "BID_TOO_LOW", "message": "Minimum next bid is 1900", "details": { "minimumNext": 1900 } },
  "meta": { "requestId": "01J..." } }
```

### Headers

| Header                           | When                                       |
| -------------------------------- | ------------------------------------------ |
| `Authorization: Bearer <access>` | All authenticated routes                   |
| `Idempotency-Key: <ulid>`        | **Required** on every money-mutating POST  |
| `X-Request-Id`                   | Optional, echoed back, generated if absent |

### Status codes

`200` ok, `201` created, `204` no content, `400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict (state machine violation), `422` domain rule rejection, `429` rate limited, `500` unexpected.

### Pagination

Cursor based. `?limit=20&cursor=<ulid>`. Never offset, because live data shifts under the reader.

---

## 2. identity

| Method | Path                    | Auth | Description                           |
| ------ | ----------------------- | ---- | ------------------------------------- |
| POST   | `/auth/register`        | none | Create buyer account                  |
| POST   | `/auth/login`           | none | Returns access + refresh              |
| POST   | `/auth/refresh`         | none | Rotate refresh token, reuse detection |
| POST   | `/auth/logout`          | user | Revoke session family                 |
| POST   | `/auth/verify-email`    | none | Consume verification token            |
| POST   | `/auth/forgot-password` | none | Send reset email                      |
| POST   | `/auth/reset-password`  | none | Consume reset token                   |
| GET    | `/me`                   | user | Current user profile                  |
| PATCH  | `/me`                   | user | Update display name, avatar           |
| POST   | `/me/devices`           | user | Register push token                   |
| DELETE | `/me/devices/:id`       | user | Remove push token                     |

```jsonc
// POST /auth/login → 200
{
  "data": {
    "accessToken": "ey...",
    "expiresIn": 900,
    "refreshToken": "ey...",
    "user": { "id": "01J...", "displayName": "Hammas", "role": "BUYER" },
  },
}
```

---

## 3. sellers

| Method | Path                           | Auth   | Description                    |
| ------ | ------------------------------ | ------ | ------------------------------ |
| POST   | `/seller/application`          | user   | Start or update an application |
| POST   | `/seller/application/submit`   | user   | Submit for review              |
| GET    | `/seller/application`          | user   | Current application + status   |
| POST   | `/seller/documents/upload-url` | user   | Get a presigned S3 PUT url     |
| POST   | `/seller/documents`            | user   | Register an uploaded document  |
| DELETE | `/seller/documents/:id`        | user   | Remove before submission       |
| POST   | `/seller/bank-account`         | seller | Add or replace bank details    |
| GET    | `/seller/profile`              | seller | Seller profile + status        |
| PATCH  | `/seller/profile`              | seller | Update display name, bio       |

```jsonc
// POST /seller/documents/upload-url
// request
{ "type": "GOVERNMENT_ID", "fileName": "id.jpg", "mimeType": "image/jpeg", "sizeBytes": 482910 }
// response → 200
{ "data": { "uploadUrl": "https://...", "storageKey": "seller-docs/01J.../id.jpg", "expiresIn": 300 } }
```

> Documents go to the **private** bucket. `storageKey` is never a public URL. Admin reads go through a signed-URL endpoint with a 60 second expiry and an audit log entry.

---

## 4. catalog

| Method | Path                              | Auth   | Description                                                                                                                                                                        |
| ------ | --------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/categories`                     | none   | Category tree                                                                                                                                                                      |
| GET    | `/catalog/products`               | none   | Public browse. ACTIVE products only, cursor paginated. Optional filters: `categoryId`, `sellerId`, `q` (title search). `available` = quantity minus reserved. Images are CDN URLs. |
| GET    | `/catalog/products/:id`           | none   | Public product detail. 404 `PRODUCT_NOT_FOUND` unless the product is ACTIVE.                                                                                                       |
| GET    | `/products`                       | seller | Own products, filterable                                                                                                                                                           |
| POST   | `/products`                       | seller | Create product                                                                                                                                                                     |
| GET    | `/products/:id`                   | seller | Detail                                                                                                                                                                             |
| PATCH  | `/products/:id`                   | seller | Update                                                                                                                                                                             |
| DELETE | `/products/:id`                   | seller | Archive                                                                                                                                                                            |
| POST   | `/products/:id/images/upload-url` | seller | Presigned PUT                                                                                                                                                                      |
| POST   | `/products/:id/images`            | seller | Attach uploaded image                                                                                                                                                              |
| DELETE | `/products/:id/images/:imageId`   | seller | Remove image                                                                                                                                                                       |

---

## 5. channels

| Method | Path                   | Auth     | Description                                                                                                           |
| ------ | ---------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/channels`            | none     | Active channels, most followed first, cursor paginated. Optional filter `sellerId` returns that seller's one channel. |
| GET    | `/channels/:slug`      | optional | Public channel profile. Returns `sellerId`; no raw `bannerKey` (`bannerUrl` is the CDN URL).                          |
| PATCH  | `/channel`             | seller   | Update own channel                                                                                                    |
| POST   | `/channels/:id/follow` | user     | Follow                                                                                                                |
| DELETE | `/channels/:id/follow` | user     | Unfollow                                                                                                              |
| GET    | `/me/following`        | user     | Followed channels                                                                                                     |

---

## 6. streaming

| Method | Path                         | Auth       | Description                                                                                                                              |
| ------ | ---------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/streams/live`              | optional   | Live directory, cursor paginated                                                                                                         |
| GET    | `/streams/:id`               | optional   | Session detail                                                                                                                           |
| GET    | `/streams/:id/purchases`     | optional   | Recent purchases for this session (resolved sales), cursor paginated. Returns winner display name, amount, mode, product, resolved time. |
| POST   | `/streams`                   | seller     | Create a session (scheduled or immediate)                                                                                                |
| POST   | `/streams/:id/start`         | seller     | Go live, returns publish token                                                                                                           |
| POST   | `/streams/:id/end`           | seller     | End the stream                                                                                                                           |
| POST   | `/streams/:id/viewer-token`  | user       | Subscribe token for this viewer                                                                                                          |
| POST   | `/streams/:id/mods`          | seller     | Add a moderator to this stream                                                                                                           |
| DELETE | `/streams/:id/mods/:modId`   | seller     | Remove a moderator from this stream                                                                                                      |
| GET    | `/streams/:id/mods`          | seller     | List moderators for this stream                                                                                                          |
| POST   | `/streams/:id/chat/timeout`  | mod/seller | Timeout a user from chat (mods + channel owner)                                                                                          |
| GET    | `/streams/:id/chat/timeouts` | seller     | List chat timeouts for this stream                                                                                                       |
| POST   | `/webhooks/stream`           | signature  | Provider webhook                                                                                                                         |

```jsonc
// POST /streams/:id/start → 200
{ "data": {
  "sessionId": "01J...",
  "publishToken": "...",          // short lived, provider specific
  "providerRoomId": "room_abc",
  "wsUrl": "wss://api.../socket"
}}

// GET /streams/:id/purchases → 200
{ "data": {
  "items": [
    {
      "saleId": "01J...",
      "productId": "01J...",
      "productTitle": "Vintage Denim Jacket",
      "productImageUrl": "https://cdn.../img.jpg",
      "mode": "AUCTION",
      "currency": "USD",
      "finalAmount": "15000",
      "winnerUserId": "01J...",
      "winnerDisplayName": "Alex",
      "resolvedAt": "2026-10-18T10:30:00Z"
    }
  ],
  "nextCursor": "01J..."
}}
```

**Guard:** `/streams/:id/start` requires `Seller.status === APPROVED`. A suspended seller gets `403 SELLER_NOT_APPROVED`.

---

## 7. sales

Most sale actions happen over WebSocket for latency. HTTP equivalents exist for reliability and for the admin panel.

| Method | Path                  | Auth     | Description                                                                                                                                              |
| ------ | --------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/sales`              | seller   | Put an item on screen. Body picks the mode.                                                                                                              |
| GET    | `/sales`              | none     | Public sale directory. Defaults to `OPEN`. Optional filters: `mode`, `status`, `productId`. Cursor paginated. No `winnerUserId`, `orderId` or `version`. |
| GET    | `/me/bids`            | user     | The buyer's own bids across all sales, most recent first, cursor paginated                                                                               |
| GET    | `/sales/:id`          | optional | Sale state snapshot                                                                                                                                      |
| POST   | `/sales/:id/cancel`   | seller   | Cancel an open sale                                                                                                                                      |
| POST   | `/sales/:id/bids`     | user     | Place bid (HTTP fallback)                                                                                                                                |
| POST   | `/sales/:id/buy`      | user     | Buy now (HTTP fallback)                                                                                                                                  |
| POST   | `/sales/:id/offers`   | user     | Submit an offer                                                                                                                                          |
| POST   | `/offers/:id/respond` | seller   | Accept, reject or counter                                                                                                                                |
| GET    | `/sales/:id/bids`     | optional | Bid history, paginated                                                                                                                                   |

```jsonc
// POST /sales  (auction)
{ "sessionId": "01J...", "productId": "01J...", "mode": "AUCTION",
  "startAmount": 1000, "currency": "USD", "durationSeconds": 30 }

// POST /sales  (buy now)
{ "sessionId": "01J...", "productId": "01J...", "mode": "BUY_NOW",
  "price": 9000, "currency": "USD", "quantity": 1 }

// POST /sales/:id/bids
// headers: Idempotency-Key required
{ "amount": 1900, "clientRef": "c_01J..." }
// 200
{ "data": { "bidId": "01J...", "amount": 1900, "endsAt": "2026-09-29T10:00:42Z",
            "extended": true, "serverNow": "2026-09-29T10:00:32Z" } }
// 422
{ "error": { "code": "BID_TOO_LOW", "message": "Minimum next bid is 2000",
             "details": { "minimumNext": 2000, "currentAmount": 1900 } } }
```

### Sale error codes

| Code                       | Meaning                                |
| -------------------------- | -------------------------------------- |
| `SALE_NOT_OPEN`            | Already resolved, cancelled or expired |
| `SALE_ENDED`               | Past `endsAt`                          |
| `BID_TOO_LOW`              | Below `currentAmount + increment`      |
| `BID_BY_SELLER`            | Seller cannot bid on own item          |
| `BIDDER_ALREADY_LEADING`   | Already the highest bidder             |
| `OUT_OF_STOCK`             | Buy now, nothing left                  |
| `OFFER_EXPIRED`            | Offer window closed                    |
| `USER_BANNED_FROM_CHANNEL` | Banned by the seller                   |

---

## 8. orders

| Method | Path                           | Auth         | Description                                    |
| ------ | ------------------------------ | ------------ | ---------------------------------------------- |
| GET    | `/orders`                      | user         | Buyer's orders                                 |
| GET    | `/orders/:id`                  | user/seller  | Detail, scoped to participant                  |
| POST   | `/orders/:id/address`          | buyer        | Set or update shipping address before shipment |
| GET    | `/seller/orders`               | seller       | Seller's order queue, filter by status         |
| POST   | `/orders/:id/ship`             | seller       | Mark shipped with carrier + tracking           |
| POST   | `/orders/:id/confirm-delivery` | buyer        | Buyer confirms receipt                         |
| POST   | `/orders/:id/cancel`           | seller/admin | Cancel before shipment                         |

```jsonc
// POST /orders/:id/ship
{ "carrier": "USPS", "trackingNumber": "9400111899223..." }
```

---

## 9. payments

| Method | Path                     | Auth      | Description                                     |
| ------ | ------------------------ | --------- | ----------------------------------------------- |
| POST   | `/payments/setup-intent` | user      | Save a card for fast in-stream checkout         |
| GET    | `/payments/methods`      | user      | Saved cards                                     |
| DELETE | `/payments/methods/:id`  | user      | Remove card                                     |
| POST   | `/orders/:id/pay`        | buyer     | Pay for an order. **Idempotency-Key required.** |
| POST   | `/webhooks/stripe`       | signature | Processor webhook                               |

**Webhook handling is the money-critical path:**

1. Verify the signature. Reject anything unsigned.
2. Insert into `WebhookEvent` with `providerEventId` unique. A duplicate insert means already seen, return `200` and stop.
3. Enqueue processing. Return `200` fast. Never do ledger work inside the HTTP handler.
4. The job applies the ledger transaction with an idempotency key derived from the event id.

---

## 10. ledger and payouts (seller facing)

| Method | Path                  | Auth   | Description                       |
| ------ | --------------------- | ------ | --------------------------------- |
| GET    | `/seller/balance`     | seller | Pending, available, paid out      |
| GET    | `/seller/ledger`      | seller | Entry history, paginated          |
| GET    | `/seller/payouts`     | seller | Payout history                    |
| GET    | `/seller/payouts/:id` | seller | Statement with the orders covered |

```jsonc
// GET /seller/balance → 200
{
  "data": {
    "currency": "USD",
    "pendingAmount": 42500,
    "availableAmount": 18900,
    "paidOutAmount": 320000,
    "nextPayoutDate": "2026-10-05T00:00:00Z",
  },
}
```

---

## 11. admin

All routes require `role === ADMIN`. All mutations write an `AuditLog` entry.

| Method | Path                                     | Description                               |
| ------ | ---------------------------------------- | ----------------------------------------- |
| GET    | `/admin/seller-applications`             | Review queue, filter by decision          |
| GET    | `/admin/seller-applications/:id`         | Detail with document metadata             |
| GET    | `/admin/documents/:id/url`               | Signed 60s URL. Logged.                   |
| POST   | `/admin/seller-applications/:id/approve` | Approve, creates channel                  |
| POST   | `/admin/seller-applications/:id/reject`  | Reject with reason                        |
| POST   | `/admin/sellers/:id/suspend`             | Suspend, ends live streams, holds payouts |
| POST   | `/admin/sellers/:id/reinstate`           | Reinstate                                 |
| PATCH  | `/admin/sellers/:id/commission`          | Override commission rate                  |
| GET    | `/admin/orders`                          | All orders, filterable                    |
| POST   | `/admin/orders/:id/refund`               | Full or partial refund                    |
| POST   | `/admin/orders/:id/force-deliver`        | Manually confirm delivery                 |
| GET    | `/admin/payout-runs`                     | List runs                                 |
| POST   | `/admin/payout-runs`                     | Trigger a run manually                    |
| POST   | `/admin/payouts/:id/hold`                | Hold a specific payout                    |
| GET    | `/admin/ledger/reconciliation`           | Latest reconciliation report              |
| POST   | `/admin/streams/:id/kill`                | Force end a stream                        |
| POST   | `/admin/chat/messages/:id/delete`        | Remove a message                          |
| GET    | `/admin/audit-log`                       | Audit trail, filterable                   |

---

## 12. Health and ops

| Method | Path            | Description                              |
| ------ | --------------- | ---------------------------------------- |
| GET    | `/health/live`  | Process alive                            |
| GET    | `/health/ready` | Postgres + Redis reachable               |
| GET    | `/metrics`      | Prometheus format, internal network only |

---

## 13. Rate limits

| Scope                 | Limit                       |
| --------------------- | --------------------------- |
| `/auth/login`         | 5 per 15 min per IP + email |
| `/auth/register`      | 3 per hour per IP           |
| Bid (WS or HTTP)      | 5/sec per user              |
| Chat                  | 3/sec per user              |
| Offer                 | 2/sec per user              |
| Upload URL requests   | 20/min per user             |
| Default authenticated | 100/min per user            |

Exceeded limits return `429` with `Retry-After`.
