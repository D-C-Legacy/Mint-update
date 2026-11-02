import { api } from './index';

// Not in 05-API-SPEC.md — built new for the live-streaming work (streaming_progress.md, 14 Oct
// 2026). Public read shape from GET /streams/live and GET /streams/:id.
export type StreamSession = {
  id: string;
  channelId: string;
  title: string;
  status: string;
  scheduledFor: string | null;
  startedAt: string | null;
  endedAt: string | null;
  viewerCount: number;
  thumbnailUrl: string | null;
  autoQueueEnabled: boolean;
};

export type StreamSessionPage = { items: StreamSession[]; nextCursor: string | null };

export type QueueItemMode = 'AUCTION' | 'BUY_NOW' | 'OFFER';

// The item a seller currently has featured, resolved server-side (room.state's own enrichment,
// founder_requests.md §3). Null when nothing is featured yet.
export type CurrentItem = {
  itemId: string;
  productId: string;
  saleId: string;
  mode: QueueItemMode;
  currentAmount: number | null;
  price: number | null;
  endsAt: string | null;
};

export type ViewerAccess = {
  providerRoomId: string;
  viewerToken: { mode: 'hls'; playbackUrl: string };
  wsUrl: string;
};

// What the seller actually broadcasts with: a real RTMP ingest endpoint + stream key for OBS (or
// any RTMP tool) — v1 has no native in-app camera broadcast, see streaming_progress.md decision 5.
export type PublisherAccess = {
  sessionId: string;
  publishToken: { mode: 'rtmp'; ingestEndpoint: string; streamKey: string };
  providerRoomId: string;
  wsUrl: string;
};

export type QueueItemStatus = 'PENDING' | 'ACTIVE' | 'DONE';

export type QueueItem = {
  id: string;
  sessionId: string;
  productId: string;
  position: number;
  mode: QueueItemMode;
  // Captured up front at add-to-queue time (round5 §5, 26 Oct 2026) — mode-conditional, mirroring
  // FeatureQueueItemInput: AUCTION uses startAmount, BUY_NOW uses price+quantity, OFFER uses
  // neither. Null for rows added before this existed.
  startAmount: number | null;
  price: number | null;
  quantity: number | null;
  status: QueueItemStatus;
  saleId: string | null;
  createdAt: string;
  updatedAt: string;
};

// Every currently-live session, most recently started first. Public, no sign-in needed — same as
// GET /categories and GET /channels/:slug.
export function listLiveStreams(cursor?: string): Promise<StreamSessionPage> {
  return api.request<StreamSessionPage>('/streams/live', {
    query: { limit: 20, cursor },
    auth: false,
  });
}

export function getStreamSession(sessionId: string): Promise<StreamSession> {
  return api.request<StreamSession>(`/streams/${encodeURIComponent(sessionId)}`, { auth: false });
}

// Real HLS playback access for one session. Requires sign-in; a fresh call is made each time a
// reel becomes the one on screen, not cached across app sessions.
export function getViewerToken(sessionId: string): Promise<ViewerAccess> {
  return api.request<ViewerAccess>(`/streams/${encodeURIComponent(sessionId)}/viewer-token`, {
    method: 'POST',
  });
}

// Seller go-live routes below (05-API-SPEC.md has none of this — built new for the live-streaming
// work). Ownership (the session's channel belongs to this seller) is enforced server-side.
export function createStream(title: string): Promise<{ sessionId: string }> {
  return api.request<{ sessionId: string }>('/streams', { method: 'POST', body: { title } });
}

export function startStream(sessionId: string): Promise<PublisherAccess> {
  return api.request<PublisherAccess>(`/streams/${encodeURIComponent(sessionId)}/start`, {
    method: 'POST',
  });
}

export function endStream(sessionId: string): Promise<{ sessionId: string; status: string }> {
  return api.request(`/streams/${encodeURIComponent(sessionId)}/end`, { method: 'POST' });
}

export function listQueue(sessionId: string): Promise<{ items: QueueItem[] }> {
  return api.request<{ items: QueueItem[] }>(`/streams/${encodeURIComponent(sessionId)}/queue`, {
    auth: false,
  });
}

// Mirrors FeatureQueueItemInput's own shape — pricing moved here, to add-to-queue time, so the
// auto-advance job has something to feature with (round5 §5, 26 Oct 2026). No `durationSeconds`
// (that one stays a feature-time-only override, never asked for at add-time).
export type AddQueueItemInput =
  | { mode: 'AUCTION'; startAmount: number }
  | { mode: 'BUY_NOW'; price: number; quantity: number }
  | { mode: 'OFFER' };

export function addQueueItem(
  sessionId: string,
  productId: string,
  input: AddQueueItemInput,
): Promise<QueueItem> {
  return api.request<QueueItem>(`/streams/${encodeURIComponent(sessionId)}/queue`, {
    method: 'POST',
    body: { productId, ...input },
  });
}

export function reorderQueueItems(sessionId: string, orderedItemIds: string[]): Promise<unknown> {
  return api.request(`/streams/${encodeURIComponent(sessionId)}/queue/reorder`, {
    method: 'PATCH',
    body: { orderedItemIds },
  });
}

export type FeatureQueueItemInput =
  | { mode: 'AUCTION'; currency: string; startAmount: number; durationSeconds?: number }
  | { mode: 'BUY_NOW'; currency: string; price: number; quantity: number }
  | { mode: 'OFFER'; currency: string };

export function featureQueueItem(
  sessionId: string,
  itemId: string,
  input: FeatureQueueItemInput,
): Promise<{ item: QueueItem; saleId: string }> {
  return api.request<{ item: QueueItem; saleId: string }>(
    `/streams/${encodeURIComponent(sessionId)}/queue/${encodeURIComponent(itemId)}/feature`,
    { method: 'POST', body: input },
  );
}

// Randomizes which PENDING item goes live next (founder "spin the wheel" request, 21 Oct 2026) —
// broadcasts `queue.wheel-spun` to the room, opens no Sale. The seller's own screen reacts by
// opening the same "Feature" sheet a manual tap already opens, pre-filled with this item.
export function spinQueueWheel(sessionId: string): Promise<{ item: QueueItem }> {
  return api.request<{ item: QueueItem }>(`/streams/${encodeURIComponent(sessionId)}/queue/spin`, {
    method: 'POST',
  });
}

// Pause/resume the automatic feature-product queue (round5 §5, 26 Oct 2026) — per-show only, resets
// every new session.
export function setAutoQueueEnabled(
  sessionId: string,
  enabled: boolean,
): Promise<{ sessionId: string; autoQueueEnabled: boolean }> {
  return api.request(`/streams/${encodeURIComponent(sessionId)}/queue/auto`, {
    method: 'PATCH',
    body: { enabled },
  });
}

// Session purchases (resolved sales) — GET /v1/streams/:sessionId/purchases
export type SessionPurchase = {
  saleId: string;
  productId: string;
  productTitle: string | null;
  productImageUrl: string | null;
  mode: 'AUCTION' | 'BUY_NOW' | 'OFFER';
  currency: string;
  finalAmount: string; // minor units as string
  winnerUserId: string;
  winnerDisplayName: string | null;
  resolvedAt: string; // ISO 8601
};

export type SessionPurchasePage = { items: SessionPurchase[]; nextCursor: string | null };

export function listSessionPurchases(
  sessionId: string,
  cursor?: string,
): Promise<SessionPurchasePage> {
  return api.request<SessionPurchasePage>(`/streams/${encodeURIComponent(sessionId)}/purchases`, {
    query: { limit: 20, cursor },
    auth: false,
  });
}

// Stream moderation (Phase B)
export type StreamModerator = {
  id: string;
  sessionId: string;
  userId: string;
  addedBy: string;
  role: 'MODERATOR';
  createdAt: string;
};

export type ChatTimeout = {
  id: string;
  sessionId: string;
  userId: string;
  moderatorId: string;
  expiresAt: string;
  reason: 'SPAM' | 'HARASSMENT' | 'INAPPROPRIATE' | 'OTHER';
  createdAt: string;
};

export type ModeratorPage = { items: StreamModerator[]; nextCursor: string | null };
export type TimeoutPage = { items: ChatTimeout[]; nextCursor: string | null };

export function addModerator(sessionId: string, userId: string): Promise<StreamModerator> {
  return api.request<StreamModerator>(`/streams/${encodeURIComponent(sessionId)}/mods`, {
    method: 'POST',
    body: { userId },
  });
}

export function removeModerator(
  sessionId: string,
  moderatorId: string,
): Promise<{ moderatorId: string; removed: true }> {
  return api.request(
    `/streams/${encodeURIComponent(sessionId)}/mods/${encodeURIComponent(moderatorId)}`,
    {
      method: 'DELETE',
    },
  );
}

export function listModerators(sessionId: string, cursor?: string): Promise<ModeratorPage> {
  return api.request<ModeratorPage>(`/streams/${encodeURIComponent(sessionId)}/mods`, {
    query: { cursor, limit: 20 },
  });
}

export function timeoutUser(
  sessionId: string,
  userId: string,
  durationMinutes: number,
  reason: 'SPAM' | 'HARASSMENT' | 'INAPPROPRIATE' | 'OTHER' = 'OTHER',
): Promise<ChatTimeout> {
  return api.request<ChatTimeout>(`/streams/${encodeURIComponent(sessionId)}/chat/timeout`, {
    method: 'POST',
    body: { userId, durationMinutes, reason },
  });
}

export function listTimeouts(
  sessionId: string,
  userId?: string,
  activeOnly?: boolean,
  cursor?: string,
): Promise<TimeoutPage> {
  // The DTO is z.coerce.boolean() — any non-empty string (even "false") coerces to true, so the
  // param is sent only when the caller actually wants active-only, never as "false".
  return api.request<TimeoutPage>(`/streams/${encodeURIComponent(sessionId)}/chat/timeouts`, {
    query: { userId, activeOnly: activeOnly ? 'true' : undefined, cursor, limit: 20 },
  });
}
