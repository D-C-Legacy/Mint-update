import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { tokenStore } from "../api";
import { fetchCurrentUser } from "../api/identity";
import { REALTIME_URL } from "../realtime/realtime-url";
import { useAuth } from "../hooks/useAuth";

export type RealtimeStatus = "offline" | "connecting" | "connected";
type Handler = (payload: unknown) => void;
type Emit = (event: string, payload?: unknown) => void;

export type RealtimeContextValue = {
  status: RealtimeStatus;
  // Goes up by one every time the socket (re)connects. Screens that keep a snapshot of server state
  // refetch it when this changes, because events sent while the socket was down are gone for good.
  connectionEpoch: number;
  // Rooms the server has confirmed we are in (it answers room.join with room.state).
  joinedRooms: ReadonlySet<string>;
  // Listen for a server event (06-REALTIME-AND-CONCURRENCY.md §2). Returns the unsubscribe function.
  on: (event: string, handler: Handler) => () => void;
  // Ask to be in a stream session's room. Counted, so two screens can share one room; the room is
  // re-joined after a reconnect. Returns the leave function.
  joinRoom: (sessionId: string) => () => void;
  // Send an inbound event (e.g. chat.send). Fire-and-forget: the server answers with its own events
  // (chat.message / a WsException), there is no ack callback.
  emit: Emit;
};

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);

// One Socket.IO connection to the realtime server while a user is signed in. The access token goes
// in the handshake and is read again on every reconnect attempt, so a refreshed token is picked up.
// An expired token makes the handshake fail; the API client refreshes tokens on a 401, so one cheap
// authenticated request is enough to get a fresh token before the next attempt.
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const userId = auth.state === "authenticated" ? (auth.user?.id ?? null) : null;
  const [status, setStatus] = useState<RealtimeStatus>("offline");
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const [joinedRooms, setJoinedRooms] = useState<ReadonlySet<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);
  const listeners = useRef(new Map<string, Set<Handler>>());
  const rooms = useRef(new Map<string, number>());

  useEffect(() => {
    if (!userId) return;
    setStatus("connecting");
    const socket = io(REALTIME_URL, {
      auth: (cb) => cb({ token: tokenStore.get()?.accessToken ?? "" }),
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("connected");
      setConnectionEpoch((n) => n + 1);
      // Rooms do not survive a reconnect on the server side: ask for each one again.
      for (const sessionId of rooms.current.keys()) socket.emit("room.join", { sessionId });
    });
    socket.on("disconnect", () => {
      setStatus("connecting");
      setJoinedRooms(new Set());
    });
    socket.on("connect_error", () => {
      setStatus("connecting");
      // Most likely an expired access token: this request refreshes it if so.
      void fetchCurrentUser().catch(() => undefined);
    });
    socket.on("room.state", (data: { session?: { id?: string } }) => {
      const id = data.session?.id;
      if (id) setJoinedRooms((prev) => new Set(prev).add(id));
    });
    socket.onAny((event: string, payload: unknown) => {
      listeners.current.get(event)?.forEach((handler) => handler(payload));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setStatus("offline");
      setJoinedRooms(new Set());
    };
  }, [userId]);

  const on = useCallback((event: string, handler: Handler) => {
    let set = listeners.current.get(event);
    if (!set) {
      set = new Set();
      listeners.current.set(event, set);
    }
    set.add(handler);
    return () => {
      listeners.current.get(event)?.delete(handler);
    };
  }, []);

  const joinRoom = useCallback((sessionId: string) => {
    const count = rooms.current.get(sessionId) ?? 0;
    rooms.current.set(sessionId, count + 1);
    if (count === 0 && socketRef.current?.connected) socketRef.current.emit("room.join", { sessionId });
    return () => {
      const left = (rooms.current.get(sessionId) ?? 1) - 1;
      if (left > 0) {
        rooms.current.set(sessionId, left);
        return;
      }
      rooms.current.delete(sessionId);
      if (socketRef.current?.connected) socketRef.current.emit("room.leave", { sessionId });
      setJoinedRooms((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    };
  }, []);

  const emit = useCallback((event: string, payload?: unknown) => {
    socketRef.current?.emit(event, payload);
  }, []);

  const value = useMemo(
    () => ({ status, connectionEpoch, joinedRooms, on, joinRoom, emit }),
    [status, connectionEpoch, joinedRooms, on, joinRoom, emit],
  );
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
