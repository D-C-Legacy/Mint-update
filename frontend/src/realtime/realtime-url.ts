import { API_BASE_URL } from "../api/client";

export const DEFAULT_REALTIME_PORT = "3001";

// The realtime server (main.realtime.ts) is a separate process from the HTTP API, on its own port.
// EXPO_PUBLIC_REALTIME_URL wins when set. Otherwise it is the API's host on the realtime port, so a
// phone that reaches the API at the computer's LAN address reaches the realtime server there too.
// Expo inlines EXPO_PUBLIC_* at build time, so a changed value needs a restart, not a hot reload.
export function resolveRealtimeUrl(apiBaseUrl: string = API_BASE_URL, override?: string): string {
  const explicit = override ?? process.env.EXPO_PUBLIC_REALTIME_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const url = new URL(apiBaseUrl);
  return `${url.protocol}//${url.hostname}:${DEFAULT_REALTIME_PORT}`;
}

export const REALTIME_URL: string = resolveRealtimeUrl();
