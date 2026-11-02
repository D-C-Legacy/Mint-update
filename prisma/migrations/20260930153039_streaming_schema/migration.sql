-- CreateEnum
CREATE TYPE "StreamStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StreamSession" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "StreamStatus" NOT NULL DEFAULT 'SCHEDULED',
    "providerRoomId" TEXT,
    "scheduledFor" TIMESTAMPTZ(6),
    "startedAt" TIMESTAMPTZ(6),
    "endedAt" TIMESTAMPTZ(6),
    "peakViewers" INTEGER NOT NULL DEFAULT 0,
    "itemsSold" INTEGER NOT NULL DEFAULT 0,
    "grossAmount" BIGINT NOT NULL DEFAULT 0,
    "thumbnailKey" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StreamSession_providerRoomId_key" ON "StreamSession"("providerRoomId");

-- CreateIndex
CREATE INDEX "StreamSession_status_startedAt_idx" ON "StreamSession"("status", "startedAt");

-- CreateIndex
CREATE INDEX "StreamSession_channelId_startedAt_idx" ON "StreamSession"("channelId", "startedAt");

-- AddForeignKey
ALTER TABLE "StreamSession" ADD CONSTRAINT "StreamSession_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
