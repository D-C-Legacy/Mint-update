-- AlterTable
ALTER TABLE "StreamSession" ADD COLUMN "autoQueueEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StreamQueueItem" ADD COLUMN "startAmount" BIGINT,
ADD COLUMN "price" BIGINT,
ADD COLUMN "quantity" INTEGER;
