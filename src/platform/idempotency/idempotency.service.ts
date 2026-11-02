import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type IdempotencyCheck =
  | { readonly outcome: 'proceed' }
  | { readonly outcome: 'replay'; readonly statusCode: number; readonly responseBody: unknown }
  | { readonly outcome: 'in_progress' }
  | { readonly outcome: 'body_mismatch' };

// No doc gives a replay-window number — same class of literal-TTL placeholder as the P1-03 JWT
// purpose-token TTLs and P2-02's presigned-URL TTLs. 24h matches the common Stripe-style
// idempotency-key convention; `IdempotencyRecord.expiresAt`/its index exist for a future sweep
// job to actually enforce this, which this ticket does not build (flagged in MEMORY.md).
const RECORD_TTL_MS = 24 * 60 * 60 * 1000;

// 03-DATA-MODEL.md §12's IdempotencyRecord, reproduced exactly. Lives in platform/ like
// WebhookEventService (same shape: a dedupe table with no module-specific business logic, no
// swappable implementation, so no port — same "ports are for genuinely swappable things"
// precedent MEMORY.md already establishes for this kind of platform-owned table).
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  // Atomically claims `key` for this request, or reports what to do if it's already claimed.
  // The claim itself is the INSERT (key is the table's primary key) — a concurrent claimant's
  // INSERT fails with P2002, exactly the same race-as-dedupe pattern as WebhookEventService and
  // channels' slug collision handling.
  async checkAndLock(key: string, userId: string | undefined, endpoint: string, requestHash: string): Promise<IdempotencyCheck> {
    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          key,
          userId: userId ?? null,
          endpoint,
          requestHash,
          lockedAt: new Date(),
          expiresAt: new Date(Date.now() + RECORD_TTL_MS),
        },
      });
      return { outcome: 'proceed' };
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
        throw err;
      }
    }

    const existing = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
    if (!existing) {
      // The other claimant released the key (its own operation threw unexpectedly, see
      // `release()`) in the gap between our failed INSERT and this read — the slot is free
      // again; retry as a fresh claim rather than treating a now-stale P2002 as still-locked.
      return this.checkAndLock(key, userId, endpoint, requestHash);
    }
    if (existing.requestHash !== requestHash) {
      return { outcome: 'body_mismatch' };
    }
    if (existing.completedAt && existing.statusCode !== null) {
      return { outcome: 'replay', statusCode: existing.statusCode, responseBody: existing.responseBody };
    }
    return { outcome: 'in_progress' };
  }

  // Called once the guarded handler's outcome is known — a success, or an expected domain
  // rejection (both are deterministic given the same input and safe to replay verbatim on a
  // retry). Must be awaited before the response is actually sent, not fired-and-forgotten,
  // or an immediate client retry could race ahead of this write and see a false `in_progress`.
  async complete(key: string, statusCode: number, responseBody: unknown): Promise<void> {
    await this.prisma.idempotencyRecord.update({
      where: { key },
      data: { completedAt: new Date(), statusCode, responseBody: (responseBody ?? null) as Prisma.InputJsonValue },
    });
  }

  // Called when the guarded handler throws something that isn't a known HttpException — a
  // genuinely unexpected failure (infra fault, crash), not a deterministic business outcome.
  // Releasing the key lets a real retry actually re-attempt the operation instead of being
  // stuck replaying nothing forever.
  async release(key: string): Promise<void> {
    await this.prisma.idempotencyRecord.delete({ where: { key } }).catch(() => undefined);
  }
}
