import type { StreamQueueItem as PrismaStreamQueueItem } from '@prisma/client';
import { StreamQueueItem } from '../../domain/entities/stream-queue-item.entity';

export function toDomainStreamQueueItem(row: PrismaStreamQueueItem): StreamQueueItem {
  return {
    id: row.id,
    sessionId: row.sessionId,
    productId: row.productId,
    position: row.position,
    // The column's DB type is the full SaleMode enum (shared with Sale.mode, reusing one Postgres
    // enum rather than defining a near-duplicate) — the Prisma row's mode is already the domain's
    // QueueItemMode shape (OFFER included since 16 Oct 2026), so no cast is needed here.
    mode: row.mode,
    startAmount: row.startAmount,
    price: row.price,
    quantity: row.quantity,
    status: row.status,
    saleId: row.saleId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
