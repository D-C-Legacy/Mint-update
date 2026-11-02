import { useCallback, useEffect, useState } from 'react';
import { useRealtime } from './useRealtime';
import type { StreamSession } from '../api/streams';

// One live chat message, as the backend sends it (chat.message) and as room.state replays it
// (recentMessages). `displayName` is resolved server-side — ChatMessage only carries a userId, and
// the raw id is never shown to other viewers.
export type LiveChatMessage = {
  id: string;
  displayName: string;
  body: string;
  type: string;
  createdAt: string;
};

function obj(payload: unknown): Record<string, unknown> | null {
  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)
    : null;
}

// Tolerates a missing displayName (cached entries written before the field existed) by falling back
// to the userId, matching the server's own `displayName ?? userId` fallback.
function normalize(raw: unknown): LiveChatMessage | null {
  const m = obj(raw);
  if (!m) return null;
  const id = m['id'];
  const body = m['body'];
  if (typeof id !== 'string' || typeof body !== 'string') return null;
  const displayName =
    typeof m['displayName'] === 'string' && m['displayName']
      ? m['displayName']
      : typeof m['userId'] === 'string' && m['userId']
        ? m['userId']
        : 'Guest';
  return {
    id,
    displayName,
    body,
    type: typeof m['type'] === 'string' ? m['type'] : 'USER',
    createdAt: typeof m['createdAt'] === 'string' ? m['createdAt'] : '',
  };
}

let clientRefCounter = 0;

// Real, shared live-chat state for one stream reel — used by both the native `LiveReel` and the
// desktop `LiveReelDesktop`. History is seeded from room.state's `recentMessages` (sent once per
// room.join and again on every reconnect), then live `chat.message` events append and
// `chat.deleted` removes. Sending is a fire-and-forget `chat.send`; the server broadcasts the
// message back to the whole room (including the sender), so there is no local echo to maintain.
export function useLiveChat(session: StreamSession, active: boolean) {
  const realtime = useRealtime();
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);

  useEffect(() => {
    if (!active) return undefined;
    return realtime.on('room.state', (payload) => {
      const p = obj(payload);
      const sessionField = obj(p?.['session']);
      if (!p || sessionField?.['id'] !== session.id) return;
      const raw = p['recentMessages'];
      if (Array.isArray(raw)) {
        // Replace with the server's authoritative recent list. Live messages received since the
        // last join are already in it, so this also dedupes on reconnect.
        setMessages(raw.map(normalize).filter((m): m is LiveChatMessage => m !== null));
      }
    });
  }, [active, realtime.on, session.id]);

  useEffect(() => {
    if (!active) return undefined;
    const off = [
      realtime.on('chat.message', (payload) => {
        const message = normalize(obj(payload)?.['message']);
        if (!message) return;
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      }),
      realtime.on('chat.deleted', (payload) => {
        const id = obj(payload)?.['messageId'];
        if (typeof id === 'string') {
          setMessages((prev) => prev.filter((m) => m.id !== id));
        }
      }),
    ];
    return () => off.forEach((fn) => fn());
  }, [active, realtime.on]);

  const send = useCallback(
    (body: string) => {
      const text = body.trim();
      if (!text) return;
      clientRefCounter += 1;
      realtime.emit('chat.send', {
        sessionId: session.id,
        body: text,
        clientRef: `c-${Date.now()}-${clientRefCounter}`,
      });
    },
    [realtime.emit, session.id],
  );

  return { messages, send };
}
