import { useCallback, useEffect, useState } from 'react';
import { getProduct, type PublicProduct } from '../api/catalog';
import { getSale, listMyBids, type MyBid, type SaleDetail } from '../api/sales';
import { describeApiError } from '../api/describe-error';
import { useApp, useAuth, useRealtime } from '../hooks';

export type BidRow = {
  bid: MyBid;
  title: string;
  productId: string | null;
  status: string;
};

// What the buyer's bid means right now. The stored bid status is never updated after placing, so
// this is worked out from the sale: current bid, and the winner once it resolves.
function bidStatus(bid: MyBid, sale: SaleDetail | undefined, me: string | undefined): string {
  if (!sale) return 'Unavailable';
  if (sale.status === 'OPEN') return sale.currentBidId === bid.id ? 'Leading' : 'Outbid';
  if (sale.status === 'RESOLVED') return sale.winnerUserId === me ? 'Won' : 'Lost';
  return 'Ended';
}

async function buildRows(bids: MyBid[], me: string | undefined): Promise<BidRow[]> {
  const saleIds = [...new Set(bids.map((bid) => bid.saleId))];
  const sales = await Promise.allSettled(saleIds.map((id) => getSale(id)));
  const saleById = new Map<string, SaleDetail>();
  sales.forEach((result, index) => {
    if (result.status === 'fulfilled') saleById.set(saleIds[index]!, result.value);
  });

  const productIds = [...new Set([...saleById.values()].map((sale) => sale.productId))];
  const products = await Promise.allSettled(productIds.map((id) => getProduct(id)));
  const productById = new Map<string, PublicProduct>();
  products.forEach((result, index) => {
    if (result.status === 'fulfilled') productById.set(productIds[index]!, result.value);
  });

  return bids.map((bid) => {
    const sale = saleById.get(bid.saleId);
    const product = sale ? productById.get(sale.productId) : undefined;
    return {
      bid,
      title: product?.title ?? 'Product unavailable',
      productId: sale?.productId ?? null,
      status: bidStatus(bid, sale, me),
    };
  });
}

// Shared buyer-bids loading, used by both the mobile list and the desktop Collection layout.
export function useMyBidsList() {
  const app = useApp();
  const auth = useAuth();
  const me = auth.user?.id;
  const realtime = useRealtime();
  // Bumped by a push (a bid of mine was accepted or outbid) to re-read the list.
  const [version, setVersion] = useState(0);
  const [rows, setRows] = useState<BidRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let alive = true;
    listMyBids()
      .then(async (page) => {
        const built = await buildRows(page.items, me);
        if (!alive) return;
        setRows(built);
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
  }, [me, version, realtime.connectionEpoch]);

  // My bids change when mine is accepted or someone outbids me: both arrive on my own channel.
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    const off = [realtime.on('bid.accepted', bump), realtime.on('bid.outbid', bump)];
    return () => off.forEach((fn) => fn());
  }, [realtime.on]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listMyBids(nextCursor);
      const built = await buildRows(page.items, me);
      setRows((prev) => [...prev, ...built]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, app, me]);

  return { rows, nextCursor, status, error, loadingMore, loadMore };
}
