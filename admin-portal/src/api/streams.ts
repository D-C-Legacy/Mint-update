// Typed wrappers around GET /streams/live (public) and the admin kill/chat-delete routes.
// Shapes hand-mirror stream-session.view.ts's PublicStreamSessionView and chat-message.entity.ts.
import { apiClient } from '../auth/AuthContext';
import type { CursorPage } from './applications';

export type StreamStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';

export type PublicStreamSession = {
  id: string;
  channelId: string;
  title: string;
  status: StreamStatus;
  scheduledFor: string | null;
  startedAt: string | null;
  endedAt: string | null;
  viewerCount: number;
  thumbnailUrl: string | null;
};

export type ChatMessageType = 'USER' | 'SYSTEM' | 'BID_ANNOUNCE' | 'SALE_ANNOUNCE';

export type ChatMessage = {
  id: string;
  sessionId: string;
  userId: string;
  body: string;
  type: ChatMessageType;
  isDeleted: boolean;
  deletedByUserId: string | null;
  createdAt: string;
};

export function listLiveStreams(params: { cursor?: string }): Promise<CursorPage<PublicStreamSession>> {
  return apiClient.request('/streams/live', { query: { cursor: params.cursor, limit: 20 }, auth: false });
}

export function killStream(sessionId: string): Promise<{ id: string; status: StreamStatus }> {
  return apiClient.request(`/admin/streams/${sessionId}/kill`, { method: 'POST' });
}

export function deleteChatMessage(messageId: string): Promise<{ sessionId: string; messageId: string }> {
  return apiClient.request(`/admin/chat/messages/${messageId}/delete`, { method: 'POST' });
}
