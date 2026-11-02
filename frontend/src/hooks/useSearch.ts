import { useEffect, useState } from 'react';
import { listProducts, toCards } from '../api/catalog';
import { listChannels, type ChannelSummary } from '../api/channels';
import { useAsync } from '../api/use-async';

// Shared search state, used by both the mobile layout and the desktop 2-column layout (filters left,
// results right) so the two can't drift.
export function useSearch() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [tab, setTab] = useState('Products');
  const [condition, setCondition] = useState('All');

  // Wait for a pause in typing before asking the API.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const products = useAsync(
    async () => toCards((await listProducts({ q: debounced || undefined, limit: 40 })).items),
    [debounced],
  );
  const sellers = useAsync(async () => (await listChannels({ limit: 50 })).items, []);

  const sellerMatches =
    sellers.state.status === 'ready'
      ? sellers.state.data.filter((channel: ChannelSummary) =>
          (channel.name + ' ' + (channel.bio ?? ''))
            .toLowerCase()
            .includes(debounced.toLowerCase()),
        )
      : [];

  return {
    query,
    setQuery,
    debounced,
    tab,
    setTab,
    condition,
    setCondition,
    products,
    sellers,
    sellerMatches,
  };
}
