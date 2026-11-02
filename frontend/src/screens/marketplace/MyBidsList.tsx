import React from "react";
import { AppText, Button, EmptyState, MenuRow } from "../../components";
import { ROUTES } from "../../constants/routes";
import { useApp } from "../../context";
import { useMyBidsList } from "../../hooks/useMyBidsList";

// The buyer's own bids (mobile layout). Data comes from the shared `useMyBidsList` hook; the desktop
// Collection layout reuses the same hook.
export function MyBidsList() {
  const app = useApp();
  const { rows, nextCursor, status, error, loadingMore, loadMore } = useMyBidsList();

  if (status === "loading") return <AppText muted>Loading your bids…</AppText>;
  if (status === "error") return <EmptyState title="Couldn't load your bids" detail={error} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No bids yet"
        detail="Bids you place on live auctions show here."
        onPress={() => app.navigate(ROUTES.DISCOVER)}
      />
    );
  }
  return (
    <>
      {rows.map((row) => (
        <MenuRow
          key={row.bid.id}
          title={row.title}
          detail={`$${(row.bid.amount / 100).toFixed(2)} · ${row.status}`}
          onPress={() => (row.productId ? app.navigate(ROUTES.PRODUCT, row.productId) : undefined)}
        />
      ))}
      {nextCursor ? <Button secondary label="Load more" loading={loadingMore} onPress={loadMore} /> : null}
    </>
  );
}
