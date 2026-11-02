-- CreateEnum
CREATE TYPE "QueueItemStatus" AS ENUM ('PENDING', 'ACTIVE', 'DONE');

-- CreateTable
CREATE TABLE "StreamQueueItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "mode" "SaleMode" NOT NULL,
    "status" "QueueItemStatus" NOT NULL DEFAULT 'PENDING',
    "saleId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StreamQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StreamQueueItem_saleId_key" ON "StreamQueueItem"("saleId");

-- CreateIndex
CREATE INDEX "StreamQueueItem_sessionId_position_idx" ON "StreamQueueItem"("sessionId", "position");

-- CreateIndex
CREATE INDEX "StreamQueueItem_sessionId_status_idx" ON "StreamQueueItem"("sessionId", "status");

-- AddForeignKey
ALTER TABLE "StreamQueueItem" ADD CONSTRAINT "StreamQueueItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StreamSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamQueueItem" ADD CONSTRAINT "StreamQueueItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
