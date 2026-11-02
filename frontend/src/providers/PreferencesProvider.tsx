import React, { createContext, useCallback, useEffect, useRef, useState } from "react";
import type {
  NotificationPreferences,
  PrivacyPreferences,
} from "../types/preferences";
import { fetchPreferences, savePreferences, type PreferencesPatch } from "../api/preferences";
import { useAuth } from "../hooks/useAuth";

// Notification and privacy choices are stored on the server. Addresses (Phase 3) and cards
// (Phase 4) have their own API modules and screens and no longer live here.
type Preferences = {
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
  // False until the server's copy has loaded after sign-in. Screens disable their switches until then.
  ready: boolean;
  loadFailed: boolean;
  reload: () => void;
  // Optimistic: the switch moves at once, and is put back if the server rejects the change.
  // Resolves to false when the save failed (the caller shows the message).
  updateNotifications: (patch: Partial<NotificationPreferences>) => Promise<boolean>;
  updatePrivacy: (patch: Partial<PrivacyPreferences>) => Promise<boolean>;
};
export const PreferencesContext = createContext<Preferences | null>(null);

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  live: true,
  bids: true,
  orders: true,
  messages: true,
};
const DEFAULT_PRIVACY: PrivacyPreferences = {
  publicProfile: true,
  showActivity: false,
  onlineStatus: true,
};

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const userId = auth.state === "authenticated" ? (auth.user?.id ?? null) : null;
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [privacy, setPrivacy] = useState(DEFAULT_PRIVACY);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadTick, setLoadTick] = useState(0);
  // Latest value per key, so a rollback after a failed save restores what was on screen before that
  // change and never clobbers a later toggle that succeeded.
  const notificationsRef = useRef(notifications);
  const privacyRef = useRef(privacy);
  notificationsRef.current = notifications;
  privacyRef.current = privacy;

  // Load the server's copy after sign-in; drop it on sign-out so the next account starts clean.
  useEffect(() => {
    setNotifications(DEFAULT_NOTIFICATIONS);
    setPrivacy(DEFAULT_PRIVACY);
    setReady(false);
    setLoadFailed(false);
    if (!userId) return;
    let cancelled = false;
    fetchPreferences()
      .then((server) => {
        if (cancelled) return;
        setNotifications(server.notifications);
        setPrivacy(server.privacy);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, loadTick]);

  const reload = useCallback(() => setLoadTick((n) => n + 1), []);

  const save = useCallback(
    async <T extends object>(
      group: "notifications" | "privacy",
      patch: Partial<T>,
      current: T,
      apply: React.Dispatch<React.SetStateAction<T>>,
    ) => {
      const before: Partial<T> = {};
      for (const key of Object.keys(patch) as (keyof T)[]) before[key] = current[key];
      apply((v) => ({ ...v, ...patch }));
      try {
        await savePreferences({ [group]: patch } as PreferencesPatch);
        return true;
      } catch {
        apply((v) => ({ ...v, ...before }));
        return false;
      }
    },
    [],
  );

  const updateNotifications = useCallback(
    (patch: Partial<NotificationPreferences>) =>
      save("notifications", patch, notificationsRef.current, setNotifications),
    [save],
  );
  const updatePrivacy = useCallback(
    (patch: Partial<PrivacyPreferences>) =>
      save("privacy", patch, privacyRef.current, setPrivacy),
    [save],
  );

  return (
    <PreferencesContext.Provider
      value={{
        notifications,
        privacy,
        ready,
        loadFailed,
        reload,
        updateNotifications,
        updatePrivacy,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}
