# Data Model

**Last updated:** 2026-09-29

Prisma schema split by module under `prisma/schema/`. All ids are ULIDs stored as `String @id`. All money is `BigInt` in minor units. All timestamps are `DateTime @db.Timestamptz(6)`.

---

## 1. Conventions

```prisma
// every table
id          String   @id                    // ULID, sortable by creation
createdAt   DateTime @default(now()) @db.Timestamptz(6)
updatedAt   DateTime @updatedAt @db.Timestamptz(6)
```

- Enums live in `schema.prisma` so every file can use them
- Foreign keys are explicit, `onDelete: Restrict` by default
- Money columns: `BigInt` + a sibling `currency String @db.Char(3)`
- Index anything used in a `WHERE`, `ORDER BY` or join on a hot path

---

## 2. identity

```prisma
model User {
  id             String    @id
  email          String    @unique
  phone          String?   @unique
  passwordHash   String?   // nullable: OAuth-only accounts (Google/Apple) never set one
  displayName    String
  avatarUrl      String?
  role           UserRole  @default(BUYER)
  status         UserStatus @default(ACTIVE)
  emailVerifiedAt DateTime? @db.Timestamptz(6)
  lastLoginAt    DateTime? @db.Timestamptz(6)
  createdAt      DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime  @updatedAt @db.Timestamptz(6)

  sessions       Session[]
  devices        Device[]
  seller         Seller?
  oauthIdentities OAuthIdentity[]

  @@index([status])
}

// Not in the original spec — added 25 Oct 2026 for Google/Apple sign-in. One row per linked
// provider identity; a user can hold a password, one or more of these, or both at once.
enum OAuthProvider {
  GOOGLE
  APPLE
}

model OAuthIdentity {
  id         String        @id
  userId     String
  provider   OAuthProvider
  providerId String                      // Google/Apple "sub" claim
  email      String?                     // email the provider gave us at link time, audit only
  createdAt  DateTime      @default(now()) @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerId])
  @@index([userId])
}

model Session {
  id               String   @id
  userId           String
  refreshTokenHash String   @unique
  familyId         String            // rotation family, for reuse detection
  userAgent        String?
  ipAddress        String?
  expiresAt        DateTime @db.Timestamptz(6)
  revokedAt        DateTime? @db.Timestamptz(6)
  createdAt        DateTime @default(now()) @db.Timestamptz(6)

  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, revokedAt])
  @@index([familyId])
}

model Device {
  id           String   @id
  userId       String
  pushToken    String   @unique
  platform     DevicePlatform
  lastSeenAt   DateTime @db.Timestamptz(6)
  createdAt    DateTime @default(now()) @db.Timestamptz(6)

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

Enums: `UserRole { BUYER SELLER ADMIN }`, `UserStatus { ACTIVE SUSPENDED DELETED }`, `DevicePlatform { IOS ANDROID WEB }`

---

## 3. sellers

```prisma
model Seller {
  id              String        @id
  userId          String        @unique
  type            SellerType
  legalName       String
  displayName     String
  status          SellerStatus  @default(DRAFT)
  commissionBps   Int           @default(1000)   // basis points, 1000 = 10%
  payoutHoldDays  Int           @default(0)      // extra hold on risky sellers
  approvedAt      DateTime?     @db.Timestamptz(6)
  approvedByUserId String?
  suspendedAt     DateTime?     @db.Timestamptz(6)
  createdAt       DateTime      @default(now()) @db.Timestamptz(6)
  updatedAt       DateTime      @updatedAt @db.Timestamptz(6)

  user            User          @relation(fields: [userId], references: [id])
  application     SellerApplication?
  bankAccount     SellerBankAccount?
  channel         Channel?

  @@index([status])
}

model SellerApplication {
  id             String   @id
  sellerId       String   @unique
  submittedAt    DateTime? @db.Timestamptz(6)
  reviewedAt     DateTime? @db.Timestamptz(6)
  reviewedByUserId String?
  decision       ApplicationDecision @default(PENDING)
  rejectionReason String?
  formData       Json                 // address, tax id, business registration
  createdAt      DateTime @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @db.Timestamptz(6)

  seller         Seller   @relation(fields: [sellerId], references: [id], onDelete: Cascade)
  documents      SellerDocument[]

  @@index([decision, submittedAt])
}

model SellerDocument {
  id             String   @id
  applicationId  String
  type           DocumentType
  storageKey     String                 // private bucket key, never a public URL
  fileName       String
  mimeType       String
  sizeBytes      Int
  uploadedAt     DateTime @default(now()) @db.Timestamptz(6)
  reviewNote     String?

  application    SellerApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([applicationId])
}

model SellerBankAccount {
  id             String   @id
  sellerId       String   @unique
  accountHolder  String
  last4          String   @db.Char(4)    // only last 4 stored in plaintext
  encryptedRef   String                  // reference to encrypted store, not the number
  bankName       String?
  country        String   @db.Char(2)
  currency       String   @db.Char(3)
  verifiedAt     DateTime? @db.Timestamptz(6)
  createdAt      DateTime @default(now()) @db.Timestamptz(6)

  seller         Seller   @relation(fields: [sellerId], references: [id], onDelete: Cascade)
}
```

Enums: `SellerType { INDIVIDUAL BUSINESS }`, `SellerStatus { DRAFT PENDING_REVIEW APPROVED REJECTED SUSPENDED }`, `ApplicationDecision { PENDING APPROVED REJECTED }`, `DocumentType { GOVERNMENT_ID PROOF_OF_ADDRESS BUSINESS_REGISTRATION TAX_DOCUMENT OTHER }`

---

## 4. catalog

```prisma
model Category {
  id        String     @id
  parentId  String?
  slug      String     @unique
  name      String
  position  Int        @default(0)
  isActive  Boolean    @default(true)

  parent    Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children  Category[] @relation("CategoryTree")
  products  Product[]

  @@index([parentId, position])
}

model Product {
  id           String        @id
  sellerId     String
  categoryId   String
  title        String
  description  String?
  condition    ProductCondition @default(USED)
  status       ProductStatus @default(DRAFT)
  quantity     Int           @default(1)
  reserved     Int           @default(0)     // held by an open sale
  weightGrams  Int?
  createdAt    DateTime      @default(now()) @db.Timestamptz(6)
  updatedAt    DateTime      @updatedAt @db.Timestamptz(6)

  category     Category      @relation(fields: [categoryId], references: [id])
  images       ProductImage[]

  @@index([sellerId, status])
  @@index([categoryId, status])
}

model ProductImage {
  id         String   @id
  productId  String
  storageKey String
  position   Int      @default(0)
  width      Int?
  height     Int?

  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId, position])
}
```

Enums: `ProductCondition { NEW LIKE_NEW USED FOR_PARTS }`, `ProductStatus { DRAFT ACTIVE SOLD ARCHIVED }`

**Availability rule:** `quantity - reserved` is what can be sold. `reserved` increments when a sale opens and decrements when it resolves or cancels.

---

## 5. channels and streaming

```prisma
model Channel {
  id           String   @id
  sellerId     String   @unique
  slug         String   @unique
  name         String
  bio          String?
  bannerKey    String?
  followerCount Int     @default(0)   // projection, rebuildable
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now()) @db.Timestamptz(6)

  seller       Seller   @relation(fields: [sellerId], references: [id])
  follows      ChannelFollow[]
  streams      StreamSession[]
}

model ChannelFollow {
  channelId  String
  userId     String
  createdAt  DateTime @default(now()) @db.Timestamptz(6)

  channel    Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)

  @@id([channelId, userId])
  @@index([userId])
}

model StreamSession {
  id             String       @id
  channelId      String
  title          String
  status         StreamStatus @default(SCHEDULED)
  providerRoomId String?      @unique
  scheduledFor   DateTime?    @db.Timestamptz(6)
  startedAt      DateTime?    @db.Timestamptz(6)
  endedAt        DateTime?    @db.Timestamptz(6)
  peakViewers    Int          @default(0)
  itemsSold      Int          @default(0)
  grossAmount    BigInt       @default(0)
  thumbnailKey   String?
  createdAt      DateTime     @default(now()) @db.Timestamptz(6)

  channel        Channel      @relation(fields: [channelId], references: [id])
  sales          Sale[]
  chatMessages   ChatMessage[]

  @@index([status, startedAt])
  @@index([channelId, startedAt])
}
```

Enum: `StreamStatus { SCHEDULED LIVE ENDED CANCELLED }`

Viewer presence is **Redis only**, never Postgres. Key: `room:{sessionId}:viewers` as a sorted set with heartbeat timestamps.

---

## 6. chat

```prisma
model ChatMessage {
  id          String   @id
  sessionId   String
  userId      String
  body        String   @db.VarChar(500)
  type        ChatMessageType @default(USER)
  isDeleted   Boolean  @default(false)
  deletedByUserId String?
  createdAt   DateTime @default(now()) @db.Timestamptz(6)

  session     StreamSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
}

model ChatBan {
  id         String   @id
  channelId  String
  userId     String
  bannedByUserId String
  reason     String?
  expiresAt  DateTime? @db.Timestamptz(6)
  createdAt  DateTime @default(now()) @db.Timestamptz(6)

  @@unique([channelId, userId])
}
```

Enum: `ChatMessageType { USER SYSTEM BID_ANNOUNCE SALE_ANNOUNCE }`

Recent chat is served from a Redis capped list for speed. Postgres is the durable record.

---

## 7. sales — the core domain

```prisma
model Sale {
  id             String     @id
  sessionId      String
  sellerId       String
  productId      String
  mode           SaleMode
  status         SaleStatus @default(OPEN)
  currency       String     @db.Char(3)

  // auction fields
  startAmount    BigInt?
  currentAmount  BigInt?
  currentBidId   String?
  endsAt         DateTime?  @db.Timestamptz(6)
  extensionCount Int        @default(0)

  // buy now fields
  price          BigInt?
  quantity       Int        @default(1)

  // resolution
  winnerUserId   String?
  finalAmount    BigInt?
  resolvedAt     DateTime?  @db.Timestamptz(6)
  orderId        String?    @unique

  version        Int        @default(0)   // optimistic concurrency guard
  createdAt      DateTime   @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime   @updatedAt @db.Timestamptz(6)

  session        StreamSession @relation(fields: [sessionId], references: [id])
  bids           Bid[]
  offers         Offer[]

  @@index([sessionId, status])
  @@index([status, endsAt])        // auction close sweeper
  @@index([sellerId, resolvedAt])
}

model Bid {
  id          String    @id
  saleId      String
  userId      String
  amount      BigInt
  status      BidStatus @default(ACCEPTED)
  sequence    Int                          // strictly increasing per sale
  createdAt   DateTime  @default(now()) @db.Timestamptz(6)

  sale        Sale      @relation(fields: [saleId], references: [id], onDelete: Cascade)

  @@unique([saleId, sequence])
  @@index([saleId, amount])
  @@index([userId, createdAt])
}

model Offer {
  id            String      @id
  saleId        String
  userId        String
  amount        BigInt
  status        OfferStatus @default(PENDING)
  counterAmount BigInt?
  respondedAt   DateTime?   @db.Timestamptz(6)
  expiresAt     DateTime    @db.Timestamptz(6)
  createdAt     DateTime    @default(now()) @db.Timestamptz(6)

  sale          Sale        @relation(fields: [saleId], references: [id], onDelete: Cascade)

  @@index([saleId, status])
  @@index([userId, status])
}
```

Enums:

```
SaleMode   { AUCTION BUY_NOW OFFER }
SaleStatus { OPEN CLOSING RESOLVED CANCELLED EXPIRED }
BidStatus  { ACCEPTED OUTBID WINNING REJECTED }
OfferStatus{ PENDING ACCEPTED REJECTED COUNTERED EXPIRED WITHDRAWN }
```

**Sale state machine:**

```
OPEN ──▶ CLOSING ──▶ RESOLVED     (winner found, order created)
  │          │
  │          └─────▶ EXPIRED      (auction ended with no bids)
  └────────────────▶ CANCELLED    (seller cancelled or stream ended)
```

---

## 8. orders

```prisma
model Order {
  id                String      @id
  saleId            String      @unique
  buyerUserId       String
  sellerId          String
  status            OrderStatus @default(PENDING_PAYMENT)
  currency          String      @db.Char(3)

  itemAmount        BigInt
  shippingAmount    BigInt      @default(0)
  taxAmount         BigInt      @default(0)
  totalAmount       BigInt
  commissionBps     Int                        // snapshot at creation
  commissionAmount  BigInt
  sellerNetAmount   BigInt

  shippingAddress   Json
  carrier           String?
  trackingNumber    String?
  shippedAt         DateTime?   @db.Timestamptz(6)
  deliveredAt       DateTime?   @db.Timestamptz(6)
  deliveryConfirmedBy DeliveryConfirmationSource?
  cancelledAt       DateTime?   @db.Timestamptz(6)
  cancelReason      String?

  createdAt         DateTime    @default(now()) @db.Timestamptz(6)
  updatedAt         DateTime    @updatedAt @db.Timestamptz(6)

  payment           Payment?
  events            OrderEvent[]

  @@index([buyerUserId, createdAt])
  @@index([sellerId, status])
  @@index([status, shippedAt])
}

model OrderEvent {
  id        String   @id
  orderId   String
  type      String                 // order.created, order.paid, order.shipped ...
  payload   Json
  actorId   String?
  createdAt DateTime @default(now()) @db.Timestamptz(6)

  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId, createdAt])
}
```

Enums:

```
OrderStatus { PENDING_PAYMENT PAID SHIPPED DELIVERED COMPLETED CANCELLED REFUNDED DISPUTED }
DeliveryConfirmationSource { CARRIER BUYER AUTO ADMIN }
```

**Invariant:** `totalAmount = itemAmount + shippingAmount + taxAmount` and `sellerNetAmount = itemAmount - commissionAmount`.

---

## 9. payments

```prisma
model Payment {
  id                String        @id
  orderId           String        @unique
  provider          String        @default("stripe")
  providerIntentId  String        @unique
  providerChargeId  String?
  status            PaymentStatus @default(REQUIRES_PAYMENT)
  amount            BigInt
  currency          String        @db.Char(3)
  providerFee       BigInt?
  failureCode       String?
  failureMessage    String?
  capturedAt        DateTime?     @db.Timestamptz(6)
  createdAt         DateTime      @default(now()) @db.Timestamptz(6)
  updatedAt         DateTime      @updatedAt @db.Timestamptz(6)

  order             Order         @relation(fields: [orderId], references: [id])
  refunds           Refund[]

  @@index([status, createdAt])
}

model Refund {
  id               String       @id
  paymentId        String
  providerRefundId String       @unique
  amount           BigInt
  reason           String
  status           RefundStatus @default(PENDING)
  initiatedByUserId String?
  createdAt        DateTime     @default(now()) @db.Timestamptz(6)

  payment          Payment      @relation(fields: [paymentId], references: [id])

  @@index([paymentId])
}

model WebhookEvent {
  id            String   @id
  provider      String
  providerEventId String @unique       // dedupe key, this is the idempotency guard
  type          String
  payload       Json
  processedAt   DateTime? @db.Timestamptz(6)
  error         String?
  receivedAt    DateTime @default(now()) @db.Timestamptz(6)

  @@index([provider, type, processedAt])
}
```

Enums: `PaymentStatus { REQUIRES_PAYMENT PROCESSING SUCCEEDED FAILED CANCELLED REFUNDED PARTIALLY_REFUNDED }`, `RefundStatus { PENDING SUCCEEDED FAILED }`

---

## 10. ledger — strictest invariants in the system

Double-entry. Append only. Never updated, never deleted.

```prisma
model LedgerAccount {
  id         String            @id
  type       LedgerAccountType
  ownerId    String?                      // sellerId for seller accounts, null for platform
  currency   String            @db.Char(3)
  createdAt  DateTime          @default(now()) @db.Timestamptz(6)

  entries    LedgerEntry[]

  @@unique([type, ownerId, currency])
  @@index([ownerId])
}

model LedgerTransaction {
  id             String   @id
  type           String                    // order.paid, order.delivered, payout.sent ...
  idempotencyKey String   @unique          // replay protection
  referenceType  String                    // order, payout, refund
  referenceId    String
  description    String?
  createdAt      DateTime @default(now()) @db.Timestamptz(6)

  entries        LedgerEntry[]

  @@index([referenceType, referenceId])
  @@index([createdAt])
}

model LedgerEntry {
  id            String   @id
  transactionId String
  accountId     String
  direction     EntryDirection
  amount        BigInt                     // always positive, direction carries the sign
  currency      String   @db.Char(3)
  createdAt     DateTime @default(now()) @db.Timestamptz(6)

  transaction   LedgerTransaction @relation(fields: [transactionId], references: [id])
  account       LedgerAccount     @relation(fields: [accountId], references: [id])

  @@index([accountId, createdAt])
  @@index([transactionId])
}

model SellerBalance {
  sellerId        String   @id              // projection, rebuildable from entries
  currency        String   @db.Char(3)
  pendingAmount   BigInt   @default(0)
  availableAmount BigInt   @default(0)
  paidOutAmount   BigInt   @default(0)
  lastEntryId     String?                   // watermark for rebuild
  updatedAt       DateTime @updatedAt @db.Timestamptz(6)
}
```

Enums:

```
LedgerAccountType {
  PLATFORM_CASH        // money we hold in the bank
  PLATFORM_REVENUE     // commission earned
  PROCESSOR_FEES       // what the processor took
  SELLER_PENDING       // owed but not releasable
  SELLER_AVAILABLE     // owed and releasable
  SELLER_PAID_OUT      // already transferred
  REFUNDS_PAYABLE
}
EntryDirection { DEBIT CREDIT }
```

### Standard transactions

**Order paid** (item 10000, commission 1000, processor fee 320). Since the ledger-hardening work
(3b, Oct 2026) the fee number is real: `Payment.providerFee`, read from the charge's balance
transaction at capture time (webhook path) or expanded inline (confirm/capture path) — P6-05's
flagged "providerFee never populated" gap is closed. A fee of 0 or unknown posts without the
fee pair, never a fabricated number:

```
DEBIT  PLATFORM_CASH        10000
CREDIT SELLER_PENDING        9000
CREDIT PLATFORM_REVENUE      1000
DEBIT  PROCESSOR_FEES          320
CREDIT PLATFORM_CASH           320
```

**Refund recorded** (3b, Oct 2026 — a refund of R against an order whose buyer paid G, posted
when the Refund row is created or settles, whether the refund was issued in-app or from the
Stripe dashboard; example R = 3000 of the G = 10000 order above). The split is proportional —
commission reversed is `floor(commission × R / G)`, the seller's share is the remainder, so the
parts always sum to exactly R and rounding never profits the platform. A full refund (R = G)
degenerates to the exact mirror of the order-paid entries. The seller's share is drawn from
what the seller still holds, `SELLER_PENDING` first then `SELLER_AVAILABLE`; anything neither
holds posts as a deliberate `SELLER_PENDING` overdraft — the negative projection IS the
seller's debt, recovered automatically when their next sale credits `SELLER_PENDING` (the
founder's clawback policy; see `09-DECISIONS.md` ADR-011). Posted under transaction type
`refund.recorded` with idempotency key `refund.recorded:<providerRefundId>`:

```
CREDIT PLATFORM_CASH         3000
DEBIT  PLATFORM_REVENUE       300
DEBIT  SELLER_PENDING        2700
```

**Order delivered:**

```
DEBIT  SELLER_PENDING        9000
CREDIT SELLER_AVAILABLE      9000
```

**Payout sent:**

```
DEBIT  SELLER_AVAILABLE      9000
CREDIT SELLER_PAID_OUT       9000
DEBIT  ... PLATFORM_CASH     9000   (cash leaves)
```

**Invariant checked by a nightly job:** for every transaction, `SUM(debits) = SUM(credits)`. Any violation raises a critical alert.

---

## 11. payouts

```prisma
model PayoutRun {
  id             String         @id
  status         PayoutRunStatus @default(PENDING)
  periodStart    DateTime       @db.Timestamptz(6)
  periodEnd      DateTime       @db.Timestamptz(6)
  totalAmount    BigInt         @default(0)
  payoutCount    Int            @default(0)
  startedAt      DateTime?      @db.Timestamptz(6)
  completedAt    DateTime?      @db.Timestamptz(6)
  createdAt      DateTime       @default(now()) @db.Timestamptz(6)

  payouts        Payout[]

  @@index([status, periodEnd])
}

model Payout {
  id              String       @id
  runId           String
  sellerId        String
  amount          BigInt
  currency        String       @db.Char(3)
  status          PayoutStatus @default(PENDING)
  idempotencyKey  String       @unique
  providerTransferId String?   @unique
  failureReason   String?
  sentAt          DateTime?    @db.Timestamptz(6)
  createdAt       DateTime     @default(now()) @db.Timestamptz(6)

  run             PayoutRun    @relation(fields: [runId], references: [id])
  items           PayoutItem[]

  @@unique([runId, sellerId])
  @@index([sellerId, status])
}

model PayoutItem {
  id        String @id
  payoutId  String
  orderId   String @unique          // an order can only be paid out once
  amount    BigInt

  payout    Payout @relation(fields: [payoutId], references: [id], onDelete: Cascade)

  @@index([payoutId])
}
```

Enums: `PayoutRunStatus { PENDING RUNNING COMPLETED FAILED }`, `PayoutStatus { PENDING PROCESSING SENT FAILED REVERSED }`

**Invariant:** `PayoutItem.orderId` is unique across the whole table. An order can never appear in two payouts.

---

## 12. admin and audit

```prisma
model AuditLog {
  id           String   @id
  actorUserId  String
  action       String                  // seller.approved, order.refunded, payout.held
  targetType   String
  targetId     String
  before       Json?
  after        Json?
  reason       String?
  ipAddress    String?
  createdAt    DateTime @default(now()) @db.Timestamptz(6)

  @@index([actorUserId, createdAt])
  @@index([targetType, targetId])
}

model IdempotencyRecord {
  key          String   @id
  userId       String?
  endpoint     String
  requestHash  String
  responseBody Json?
  statusCode   Int?
  lockedAt     DateTime? @db.Timestamptz(6)
  completedAt  DateTime? @db.Timestamptz(6)
  expiresAt    DateTime  @db.Timestamptz(6)

  @@index([expiresAt])
}
```

---

## 13. Index checklist for hot paths

| Query                            | Index                                  |
| -------------------------------- | -------------------------------------- |
| Close expiring auctions          | `Sale(status, endsAt)`                 |
| Room's open sales                | `Sale(sessionId, status)`              |
| Bid history for a sale           | `Bid(saleId, amount)`                  |
| Seller order queue               | `Order(sellerId, status)`              |
| Orders awaiting delivery confirm | `Order(status, shippedAt)`             |
| Seller ledger history            | `LedgerEntry(accountId, createdAt)`    |
| Webhook dedupe                   | `WebhookEvent(providerEventId)` unique |
| Live directory                   | `StreamSession(status, startedAt)`     |
