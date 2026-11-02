// Thin wrapper around socket.io-client for the Streams & Chat page's live moderation view.
// Connects to the separate realtime process (main.realtime.ts, port 3001 in dev — a different
// process from the HTTP API on 3000), joins a stream's room the same way the mobile app's
// StreamingGateway client does ('room.join', same `room:${sessionId}` convention chat.gateway.ts
// also broadcasts to), and listens for 'chat.message'/'chat.deleted'. No new backend — this is
// exactly the existing WS contract both gateways already expose.
import { io, type Socket } from 'socket.io-client';
import type { ChatMessage } from '../api/streams';

export const REALTIME_URL: string = import.meta.env.VITE_REALTIME_URL ?? 'http://localhost:3001';

export type RoomConnection = {
  disconnect(): void;
};

export function joinStreamRoom(
  token: string,
  sessionId: string,
  handlers: {
    onMessage(message: ChatMessage): void;
    onDeleted(messageId: string): void;
    onConnect?(): void;
    onError?(message: string): void;
  },
): RoomConnection {
  const socket: Socket = io(REALTIME_URL, { auth: { token }, transports: ['websocket'] });

  socket.on('connect', () => {
    socket.emit('room.join', { sessionId });
    handlers.onConnect?.();
  });
  socket.on('chat.message', (payload: { message: ChatMessage }) => handlers.onMessage(payload.message));
  socket.on('chat.deleted', (payload: { messageId: string }) => handlers.onDeleted(payload.messageId));
  socket.on('connect_error', (err: Error) => handlers.onError?.(err.message));
  socket.on('exception', (err: { message?: string } | string) => {
    handlers.onError?.(typeof err === 'string' ? err : (err.message ?? 'WebSocket error'));
  });

  return {
    disconnect() {
      socket.disconnect();
    },
  };
}
