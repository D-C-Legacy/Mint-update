import { useEffect, useState } from 'react';
import { listLiveStreams, type StreamSession } from '../api/streams';
import { describeApiError } from '../api/describe-error';

// Shared between the mobile Live shell and the desktop Live view: loads the real live-session
// list once, and picks out which one to start on. Each platform's own layout decides how to page
// between sessions (FlatList swipe on mobile, a simple index on desktop) — this hook only owns the
// data and the "which one did the caller actually ask for" resolution.
export function useLiveFeed(streamId: string) {
  const [sessions, setSessions] = useState<StreamSession[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    listLiveStreams()
      .then((page) => {
        if (alive) setSessions(page.items);
      })
      .catch((err) => {
        if (alive) setLoadError(describeApiError(err));
      });
    return () => {
      alive = false;
    };
  }, []);

  // Jump to the requested session once the real list has loaded, falling back to the first live
  // one when the requested id isn't (or isn't live anymore).
  useEffect(() => {
    if (!sessions || sessions.length === 0) return;
    const i = Math.max(
      0,
      sessions.findIndex((s) => s.id === streamId),
    );
    setIndex(i);
  }, [streamId, sessions]);

  return { sessions, loadError, index, setIndex };
}
