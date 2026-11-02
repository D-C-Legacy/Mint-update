-- AlterTable
ALTER TABLE "User" ADD COLUMN "deletionRequestedAt" TIMESTAMPTZ(6),
ADD COLUMN "deletionScheduledAt" TIMESTAMPTZ(6);
