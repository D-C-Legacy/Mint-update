# Product Requirements Document

**Product:** Live commerce platform (live video shopping with bidding)
**Version:** 1.0
**Status:** Approved scope for v1
**Last updated:** 2026-09-29

---

## 1. What this product is

A live video shopping platform. Verified sellers broadcast from their phones. Viewers watch, chat, and buy inside the stream through three sale mechanics: live auctions, buy now, and make an offer.

Comparable products: Whatnot, TikTok Shop Live, QVC.

**Not** a listings marketplace with video bolted on. Video is the primary surface. Listings exist to feed the stream.

---

## 2. Goals

| Goal | Measure |
|---|---|
| Sellers can run a live selling show end to end | A seller streams, sells 5 items, gets paid |
| Buyers trust the money flow | Zero unexplained balance discrepancies |
| The room feels instant | Bid to broadcast under 300ms p95 |
| Platform controls who sells | 100% of sellers manually approved |
| Platform controls the money | All funds held and distributed by us |

---

## 3. Actors

| Actor | Description |
|---|---|
| **Buyer** | Browses live rooms, chats, bids, buys, pays, receives goods |
| **Seller** | Applies, gets verified, streams, sells, ships, gets paid |
| **Admin** | Platform staff: approves sellers, moderates, resolves disputes, runs payouts |
| **System** | Automated: closes auctions, captures payments, releases balances, runs payout batches |

---

## 4. Core flows

### 4.1 Seller onboarding
1. User signs up as a buyer
2. Applies to become a seller (individual or business)
3. Submits identity documents, business details, bank details
4. Application enters admin review queue
5. Admin approves or rejects with a reason
6. On approval, a channel is created and the seller can go live

**Rule:** No streaming, no selling, no payouts before approval.

### 4.2 Going live
1. Seller starts a stream from their channel
2. System issues a video provider token and creates a live session
3. Followers receive a push notification
4. The room appears in the live directory
5. Viewers join, presence is tracked, chat opens

### 4.3 Selling an item
1. Seller selects an item from their inventory and puts it on screen
2. Seller picks the sale mode: auction, buy now, or offer
3. Viewers act: place bids, tap buy now, or submit offers
4. The sale resolves (timer expiry, purchase, or accepted offer)
5. An order is created and the buyer is charged
6. Seller moves to the next item without ending the stream

### 4.4 Fulfilment
1. Seller marks the order as shipped and enters a tracking number
2. Buyer is notified and can track the parcel
3. Delivery is confirmed (carrier status or buyer confirmation or auto-confirm after N days)
4. The seller's balance moves from pending to available

### 4.5 Payout
1. On the payout schedule, the system totals each seller's available balance
2. Commission is already deducted at order level
3. One transfer per seller per run
4. Seller receives a statement listing the orders covered

---

## 5. Sale mechanics

### 5.1 Live auction
- Seller sets a starting price and a duration (default 30s, configurable)
- Minimum increment rules apply (configurable by price band)
- **Anti-snipe:** a bid within the final N seconds extends the timer by N seconds (default 10s), up to a maximum number of extensions
- Highest bid at expiry wins
- Losing bidders are notified in-room

### 5.2 Buy now
- Fixed price, quantity of 1 or more
- First valid purchase wins
- Stock decrements atomically

### 5.3 Make an offer
- Buyer proposes an amount
- Seller accepts, rejects, or counters
- Offers expire after a set window or when the item leaves the screen
- An accepted offer creates an order at the agreed price

---

## 6. Money model

**Decision: funds are held and distributed by the platform.**

- Card processing goes through a payment processor (Stripe) for the charge only
- Funds settle into the company bank account
- The platform maintains its own ledger of what each seller is owed
- Payouts are initiated by the platform on a schedule

**Balance states:** `pending` (sold, not yet delivered) → `available` (delivered, cleared) → `paid_out`

**Commission:** flat percentage per sale, recorded at order creation. Rate is configurable and versioned.

> **Compliance note:** holding and transmitting funds is a regulated activity in the US. Licensing, KYC/AML programme, 1099-K reporting and the seller agreement are the company's responsibility. The system is built to support whatever the legal advisers specify. See `09-DECISIONS.md`.

---

## 7. v1 scope

### In
- Buyer and seller accounts, auth, roles
- Seller applications, document upload, admin review queue
- Seller channels and follows
- Inventory and categories
- Live streaming sessions with viewer presence
- Live chat with moderation
- Live auction, buy now, make an offer
- Orders, payment capture, shipping with tracking
- Internal ledger, commission, payout engine
- Admin panel APIs
- Push and email notifications

### Out (designed for, built later)
- Stream replays and clips
- Discovery feed and recommendations
- Ratings, reviews, seller reputation
- Seller tiers with variable commission
- In-app shipping label purchase
- Standalone listings outside streams
- Web and TV clients
- Multi-currency

---

## 8. Non-functional requirements

| Requirement | Target |
|---|---|
| Bid accept to broadcast to all viewers | p95 under 300ms |
| Concurrent viewers per room | 5,000 |
| Concurrent live rooms | 200 |
| Chat throughput per room | 100 msg/s sustained |
| API p95 latency (non-realtime) | under 400ms |
| Availability during live hours | 99.5% |
| Ledger accuracy | Exact. No rounding drift, no lost entries. |
| Payment idempotency | Every money operation idempotent by key |

---

## 9. Clients

- **Mobile app:** React Native (Expo), built by a separate team. Buyers and sellers.
- **Admin panel:** web. Consumes the same API with an admin role.

The backend is client agnostic. Adding web or TV later requires no backend change.

---

## 10. Open items

Tracked in `09-DECISIONS.md`:
- D-001 Legal cover for fund holding
- D-002 Company accounts (bank, processor, cloud, domain)
- D-003 Commission rate
- D-004 Launch countries
- D-005 Video provider selection
