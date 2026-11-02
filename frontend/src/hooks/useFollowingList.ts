import { useCallback, useEffect, useState } from 'react';
import { listFollowedChannels, type ChannelSummary } from '../api/channels';
import { describeApiError } from '../api/describe-error';
import { useApp } from '../context';

export type ListStatus = 'loading' | 'ready' | 'error';

// Shared followed-channels loading, used by both the mobile list and the desktop Collection layout
// (list left, selected channel preview right).
export function useFollowingList() {
  const app = useApp();
  const [items, setItems] = useState<ChannelSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<ListStatus>('loading');
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let alive = true;
    listFollowedChannels()
      .then((page) => {
        if (!alive) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setStatus('ready');
      })
      .catch((err) => {
        if (!alive) return;
        setError(describeApiError(err));
        setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listFollowedChannels(nextCursor);
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, app]);

  return { items, nextCursor, status, error, loadingMore, loadMore };
}
