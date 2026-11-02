import type { StreamSession as PrismaStreamSession } from '@prisma/client';
import { StreamSession } from '../../domain/entities/stream-session.entity';

export function toDomainStreamSession(row: PrismaStreamSession): StreamSession {
  return {
    id: row.id,
    channelId: row.channelId,
    title: row.title,
    status: row.status,
    providerRoomId: row.providerRoomId,
    scheduledFor: row.scheduledFor,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    peakViewers: row.peakViewers,
    itemsSold: row.itemsSold,
    grossAmount: row.grossAmount,
    thumbnailKey: row.thumbnailKey,
    autoQueueEnabled: row.autoQueueEnabled,
    createdAt: row.createdAt,
  };
}
