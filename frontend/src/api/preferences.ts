import { api } from "./index";
import type { NotificationPreferences, PrivacyPreferences } from "../types/preferences";

// GET/PATCH /v1/me/preferences. Not in 05-API-SPEC.md: added on the user's instruction so
// notification and privacy choices are saved on the server.
export type ServerPreferences = {
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
};

export type PreferencesPatch = {
  notifications?: Partial<NotificationPreferences>;
  privacy?: Partial<PrivacyPreferences>;
};

export function fetchPreferences() {
  return api.request<ServerPreferences>("/me/preferences");
}

// Send only what changed, so two quick toggles can't overwrite each other on the server.
export function savePreferences(patch: PreferencesPatch) {
  return api.request<ServerPreferences>("/me/preferences", { method: "PATCH", body: patch });
}

export type RegisteredDevice = { id: string; platform: "IOS" | "ANDROID" | "WEB"; lastSeenAt: string };

// POST/DELETE /v1/me/devices (05-API-SPEC.md §2). Nothing calls these yet: the app has no push
// token source until a notifications package is approved (see integration_progress.md, Phase 2).
export function registerDevice(input: { pushToken: string; platform: RegisteredDevice["platform"] }) {
  return api.request<RegisteredDevice>("/me/devices", { method: "POST", body: input });
}

export function removeDevice(id: string) {
  return api.request<{ removed: true }>(`/me/devices/${id}`, { method: "DELETE" });
}
