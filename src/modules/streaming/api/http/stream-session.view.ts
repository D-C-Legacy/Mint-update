import { StreamSessionWithViewers } from '../../application/queries/list-live-sessions.query';

// Public shape for GET /streams/live and GET /streams/:id. Deliberately omits providerRoomId
// (internal provider handle), grossAmount and itemsSold (seller money and sales data), and
// peakViewers. Timestamps are ISO 8601 (05-API-SPEC.md header); the thumbnail is a CDN URL, never
// a raw storage key.
export interface PublicStreamSessionView {
  readonly id: string;
  readonly channelId: string;
  readonly title: string;
  readonly status: string;
  readonly scheduledFor: string | null;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly viewerCount: number;
  readonly thumbnailUrl: string | null;
  readonly autoQueueEnabled: boolean;
}

export function toPublicStreamSessionView(
  item: StreamSessionWithViewers,
  thumbnailUrlFor: (storageKey: string) => string,
): PublicStreamSessionView {
  const { session, viewerCount } = item;
  return {
    id: session.id,
    channelId: session.channelId,
    title: session.title,
    status: session.status,
    scheduledFor: session.scheduledFor?.toISOString() ?? null,
    startedAt: session.startedAt?.toISOString() ?? null,
    endedAt: session.endedAt?.toISOString() ?? null,
    viewerCount,
    thumbnailUrl: session.thumbnailKey ? thumbnailUrlFor(session.thumbnailKey) : null,
    autoQueueEnabled: session.autoQueueEnabled,
  };
}
