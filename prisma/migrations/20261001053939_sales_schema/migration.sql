-- CreateEnum
CREATE TYPE "SaleMode" AS ENUM ('AUCTION', 'BUY_NOW', 'OFFER');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('OPEN', 'CLOSING', 'RESOLVED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('ACCEPTED', 'OUTBID', 'WINNING', 'REJECTED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'EXPIRED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mode" "SaleMode" NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'OPEN',
    "currency" CHAR(3) NOT NULL,
    "startAmount" BIGINT,
    "currentAmount" BIGINT,
    "currentBidId" TEXT,
    "endsAt" TIMESTAMPTZ(6),
    "extensionCount" INTEGER NOT NULL DEFAULT 0,
    "price" BIGINT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "winnerUserId" TEXT,
    "finalAmount" BIGINT,
    "resolvedAt" TIMESTAMPTZ(6),
    "orderId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'ACCEPTED',
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "counterAmount" BIGINT,
    "respondedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sale_orderId_key" ON "Sale"("orderId");

-- CreateIndex
CREATE INDEX "Sale_sessionId_status_idx" ON "Sale"("sessionId", "status");

-- CreateIndex
CREATE INDEX "Sale_status_endsAt_idx" ON "Sale"("status", "endsAt");

-- CreateIndex
CREATE INDEX "Sale_sellerId_resolvedAt_idx" ON "Sale"("sellerId", "resolvedAt");

-- CreateIndex
CREATE INDEX "Bid_saleId_amount_idx" ON "Bid"("saleId", "amount");

-- CreateIndex
CREATE INDEX "Bid_userId_createdAt_idx" ON "Bid"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_saleId_sequence_key" ON "Bid"("saleId", "sequence");

-- CreateIndex
CREATE INDEX "Offer_saleId_status_idx" ON "Offer"("saleId", "status");

-- CreateIndex
CREATE INDEX "Offer_userId_status_idx" ON "Offer"("userId", "status");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StreamSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
