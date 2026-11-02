-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "SellerStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ApplicationDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('GOVERNMENT_ID', 'PROOF_OF_ADDRESS', 'BUSINESS_REGISTRATION', 'TAX_DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "Seller" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SellerType" NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "SellerStatus" NOT NULL DEFAULT 'DRAFT',
    "commissionBps" INTEGER NOT NULL DEFAULT 1000,
    "payoutHoldDays" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMPTZ(6),
    "approvedByUserId" TEXT,
    "suspendedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Seller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerApplication" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "submittedAt" TIMESTAMPTZ(6),
    "reviewedAt" TIMESTAMPTZ(6),
    "reviewedByUserId" TEXT,
    "decision" "ApplicationDecision" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "formData" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SellerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewNote" TEXT,

    CONSTRAINT "SellerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerBankAccount" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "last4" CHAR(4) NOT NULL,
    "encryptedRef" TEXT NOT NULL,
    "bankName" TEXT,
    "country" CHAR(2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "verifiedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Seller_userId_key" ON "Seller"("userId");

-- CreateIndex
CREATE INDEX "Seller_status_idx" ON "Seller"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SellerApplication_sellerId_key" ON "SellerApplication"("sellerId");

-- CreateIndex
CREATE INDEX "SellerApplication_decision_submittedAt_idx" ON "SellerApplication"("decision", "submittedAt");

-- CreateIndex
CREATE INDEX "SellerDocument_applicationId_idx" ON "SellerDocument"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerBankAccount_sellerId_key" ON "SellerBankAccount"("sellerId");

-- AddForeignKey
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerApplication" ADD CONSTRAINT "SellerApplication_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerDocument" ADD CONSTRAINT "SellerDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SellerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerBankAccount" ADD CONSTRAINT "SellerBankAccount_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
