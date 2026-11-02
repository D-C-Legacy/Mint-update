import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { type TokenStore, type Tokens } from './client';

const STORAGE_KEY = 'shopaflo.tokens';

// Minimal shape of window.localStorage, so no DOM typings are needed.
type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function browserStorage(): KeyValueStorage | null {
  return (globalThis as unknown as { localStorage?: KeyValueStorage }).localStorage ?? null;
}

// Web only: tokens survive a reload. Storage can be blocked or full, so every access is guarded
// and a failure just means the user signs in again.
export function createBrowserTokenStore(): TokenStore {
  return {
    get() {
      try {
        const raw = browserStorage()?.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Tokens) : null;
      } catch {
        return null;
      }
    },
    set(tokens) {
      try {
        browserStorage()?.setItem(STORAGE_KEY, JSON.stringify(tokens));
      } catch {
        // Ignored on purpose: the session still works until the page reloads.
      }
    },
    clear() {
      try {
        browserStorage()?.removeItem(STORAGE_KEY);
      } catch {
        // Ignored on purpose, same as set().
      }
    },
    // localStorage is already synchronous and already the source of truth for get(), so there is
    // nothing to load ahead of time.
    hydrate: () => Promise.resolve(),
  };
}

// Phones: an in-memory cache is still what get()/set() read and write (the client's hot path
// needs them synchronous), but every set()/clear() is mirrored into expo-secure-store in the
// background, and hydrate() loads whatever was there from a previous launch into that cache once,
// before AuthProvider's restore-on-launch check runs. Founder feedback (22 Oct 2026): phones had no
// persistent sign-in at all — every relaunch signed the user out, this is the fix.
function createSecureTokenStore(): TokenStore {
  let current: Tokens | null = null;
  let hydrated = false;
  return {
    get: () => current,
    set(tokens) {
      current = tokens;
      void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(tokens)).catch(() => {
        // Ignored on purpose, same reasoning as the browser store: the in-memory session still
        // works until the app is killed, it just won't survive the next launch.
      });
    },
    clear() {
      current = null;
      void SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => undefined);
    },
    async hydrate() {
      if (hydrated) return;
      hydrated = true;
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (raw) current = JSON.parse(raw) as Tokens;
      } catch {
        // Corrupt or inaccessible value: same as finding nothing, the user signs in again.
      }
    },
  };
}

export const tokenStore: TokenStore =
  Platform.OS === 'web' ? createBrowserTokenStore() : createSecureTokenStore();
