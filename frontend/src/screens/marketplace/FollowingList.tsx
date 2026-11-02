import React from "react";
import { AppText, Button, EmptyState, MenuRow } from "../../components";
import { ROUTES } from "../../constants/routes";
import { useApp } from "../../context";
import { useFollowingList } from "../../hooks/useFollowingList";

// The signed-in user's followed channels (mobile layout). Data comes from the shared
// `useFollowingList` hook; the desktop Collection layout reuses the same hook.
export function FollowingList() {
  const app = useApp();
  const { items, nextCursor, status, error, loadingMore, loadMore } = useFollowingList();

  if (status === "loading") {
    return <AppText muted>Loading your sellers…</AppText>;
  }
  if (status === "error") {
    return <EmptyState title="Couldn't load your sellers" detail={error} />;
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="Find your people"
        detail="Follow sellers to catch their next show."
        onPress={() => app.navigate(ROUTES.DISCOVER)}
      />
    );
  }
  return (
    <>
      {items.map((channel) => (
        <MenuRow
          key={channel.id}
          title={channel.name}
          detail={`${channel.followerCount} followers`}
          onPress={() => app.navigate(ROUTES.CHANNEL, channel.slug)}
        />
      ))}
      {nextCursor ? (
        <Button
          secondary
          label="Load more"
          loading={loadingMore}
          onPress={loadMore}
        />
      ) : null}
    </>
  );
}
