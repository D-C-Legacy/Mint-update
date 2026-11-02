-- CreateEnum
CREATE TYPE "SellerTeamRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF', 'VIEW_ONLY');

-- CreateEnum
CREATE TYPE "SellerInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SellerTeamMember" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SellerTeamRole" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SellerTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerInvitation" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "SellerTeamRole" NOT NULL,
    "token" TEXT NOT NULL,
    "status" "SellerInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SellerInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SellerTeamMember_sellerId_idx" ON "SellerTeamMember"("sellerId");

-- CreateIndex
CREATE INDEX "SellerTeamMember_userId_idx" ON "SellerTeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerTeamMember_sellerId_userId_key" ON "SellerTeamMember"("sellerId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerInvitation_token_key" ON "SellerInvitation"("token");

-- CreateIndex
CREATE INDEX "SellerInvitation_sellerId_status_idx" ON "SellerInvitation"("sellerId", "status");

-- CreateIndex
CREATE INDEX "SellerInvitation_email_idx" ON "SellerInvitation"("email");

-- CreateIndex
CREATE INDEX "SellerInvitation_token_idx" ON "SellerInvitation"("token");

-- AddForeignKey
ALTER TABLE "SellerTeamMember" ADD CONSTRAINT "SellerTeamMember_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerTeamMember" ADD CONSTRAINT "SellerTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerInvitation" ADD CONSTRAINT "SellerInvitation_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
