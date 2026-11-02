import { useCallback, useEffect, useState } from 'react';
import { getProduct } from '../api/catalog';
import { getSale } from '../api/sales';
import { describeApiError } from '../api/describe-error';
import { listMyOrders, type OrderView, type OrderStatus } from '../api/orders';
import { useApp, useRealtime } from '../hooks';

export type OrderListStatus = 'loading' | 'ready' | 'error';

// The product title behind an order comes from its sale. Failures show a neutral label instead.
async function productTitle(saleId: string): Promise<string> {
  try {
    const sale = await getSale(saleId);
    return (await getProduct(sale.productId)).title;
  } catch {
    return 'Order item';
  }
}

// Shared buyer-orders list loading, used by both the mobile list screen and the desktop
// master-detail layout (list left, order detail right) so the two can't drift.
export function useOrdersList() {
  const app = useApp();
  const realtime = useRealtime();
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<OrderListStatus>('loading');
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  const addPage = useCallback(async (items: OrderView[]) => {
    const pairs = await Promise.all(
      items.map(async (o) => [o.saleId, await productTitle(o.saleId)] as const),
    );
    setTitles((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
  }, []);

  useEffect(() => {
    let alive = true;
    listMyOrders()
      .then(async (page) => {
        await addPage(page.items);
        if (!alive) return;
        setOrders(page.items);
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
  }, [addPage]);

  // Live: patch a listed order's status in place instead of refetching the whole page (bid/order
  // status flips, e.g. a seller shipping while this list is open) — same "patch, don't reload"
  // choice SaleActions makes for sale.updated.
  useEffect(() => {
    return realtime.on('order.status.changed', (payload) => {
      const p = payload as { orderId?: string; status?: string };
      if (!p.orderId || !p.status) return;
      setOrders((prev) =>
        prev.map((o) => (o.id === p.orderId ? { ...o, status: p.status as OrderStatus } : o)),
      );
    });
  }, [realtime]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listMyOrders(nextCursor);
      await addPage(page.items);
      setOrders((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, app, addPage]);

  return { orders, titles, nextCursor, status, error, loadingMore, loadMore };
}
