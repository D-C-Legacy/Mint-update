-- CreateEnum
CREATE TYPE "StreamModeratorRole" AS ENUM ('MODERATOR');

-- CreateEnum
CREATE TYPE "ChatTimeoutReason" AS ENUM ('SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'OTHER');

-- CreateTable
CREATE TABLE "StreamModerator" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "role" "StreamModeratorRole" NOT NULL DEFAULT 'MODERATOR',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamModerator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatTimeout" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "reason" "ChatTimeoutReason" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatTimeout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StreamModerator_sessionId_idx" ON "StreamModerator"("sessionId");

-- CreateIndex
CREATE INDEX "StreamModerator_userId_idx" ON "StreamModerator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StreamModerator_sessionId_userId_key" ON "StreamModerator"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "ChatTimeout_sessionId_userId_idx" ON "ChatTimeout"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "ChatTimeout_sessionId_expiresAt_idx" ON "ChatTimeout"("sessionId", "expiresAt");

-- AddForeignKey
ALTER TABLE "StreamModerator" ADD CONSTRAINT "StreamModerator_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StreamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatTimeout" ADD CONSTRAINT "ChatTimeout_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StreamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
