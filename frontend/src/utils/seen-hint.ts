import { Platform } from 'react-native';

const STORAGE_KEY = 'shopaflo.liveFeedHintSeen';

// Same minimal shape as token-store.ts's KeyValueStorage — no DOM typings needed.
type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function browserStorage(): KeyValueStorage | null {
  return (globalThis as unknown as { localStorage?: KeyValueStorage }).localStorage ?? null;
}

// Web: persisted in localStorage, same as auth tokens (token-store.ts). Native: in-memory only,
// since expo-secure-store isn't an approved dependency yet — resets on every app restart until
// that dependency decision is made; a deliberate, temporary limitation, not a silent gap.
let seenInMemory = false;

export function hasSeenLiveFeedHint(): boolean {
  if (Platform.OS !== 'web') return seenInMemory;
  try {
    return browserStorage()?.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markLiveFeedHintSeen(): void {
  if (Platform.OS !== 'web') {
    seenInMemory = true;
    return;
  }
  try {
    browserStorage()?.setItem(STORAGE_KEY, '1');
  } catch {
    // Ignored on purpose, same as token-store.ts: worst case the hint shows again next reload.
  }
}
