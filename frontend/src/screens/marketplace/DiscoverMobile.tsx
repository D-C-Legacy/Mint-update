import { ROUTES } from '../../constants/routes';
import React, { useState } from 'react';
import { View } from 'react-native';
import { EmptyState, Screen, SearchBar, Section, StreamCard, s } from '../../components';
import { listCategories } from '../../api/catalog';
import { listLiveStreams } from '../../api/streams';
import { useAsync } from '../../api/use-async';
import { useApp } from '../../context';
import { CategoryRow } from './shared';

// The app's own Discover page. This is the single source of truth for that layout: the native
// entry point (`Discover.tsx`) re-exports it unchanged, and the web entry point
// (`Discover.web.tsx`) renders it too at phone-width viewports, same pattern as `MainTabShell`
// and `LiveMobileShell`. Only `Discover.web.tsx` has a second, desktop-only grid layout.
//
// Discover is the buyer's browse page: image-and-text categories, and every currently-live
// stream. GET /streams/live already returns only sessions that are actually live, so there's no
// separate "upcoming" filter to apply here.
//
// The category picker no longer filters this row: a StreamSession carries no category of its own
// (that lives on whatever product the seller happens to have featured, which can change mid-
// stream) — filtering by it would mean guessing at data the session doesn't have. Flagged rather
// than invented; the picker still exists for whatever future use needs it.
export function DiscoverMobile() {
  const app = useApp();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState('All');

  const categoriesState = useAsync(listCategories, []);
  const categories = categoriesState.state.status === 'ready' ? categoriesState.state.data : [];
  const topLevel = categories.filter((c) => c.parentId === null);

  const liveState = useAsync(() => listLiveStreams(), []);
  const liveSessions = liveState.state.status === 'ready' ? liveState.state.data.items : [];

  return (
    <Screen title={ROUTES.DISCOVER}>
      <SearchBar value={query} onChange={setQuery} onFocus={() => app.navigate(ROUTES.SEARCH)} />
      <Section title="Categories" action="All" onPress={() => setPicked('All')} />
      <CategoryRow categories={topLevel} value={picked} onChange={setPicked} />
      <Section title="Live Now" />
      {liveSessions.length > 0 ? (
        <View style={s.grid}>
          {liveSessions.map((session) => (
            <StreamCard
              key={session.id}
              session={session}
              onPress={() => app.selectStream(session.id)}
            />
          ))}
        </View>
      ) : (
        <EmptyState title="Nothing live right now" detail="Check back soon." />
      )}
    </Screen>
  );
}
