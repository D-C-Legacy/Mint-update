-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "notifyLive" BOOLEAN NOT NULL DEFAULT true,
    "notifyBids" BOOLEAN NOT NULL DEFAULT true,
    "notifyOrders" BOOLEAN NOT NULL DEFAULT true,
    "notifyMessages" BOOLEAN NOT NULL DEFAULT true,
    "privacyPublicProfile" BOOLEAN NOT NULL DEFAULT true,
    "privacyShowActivity" BOOLEAN NOT NULL DEFAULT false,
    "privacyOnlineStatus" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
