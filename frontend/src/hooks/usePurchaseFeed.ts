import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtime } from './useRealtime';
import { listSessionPurchases, type SessionPurchase } from '../api/streams';

const MAX_FEED_LENGTH = 30;

export function usePurchaseFeed(sessionId: string, active: boolean) {
  const realtime = useRealtime();
  const [feed, setFeed] = useState<SessionPurchase[]>([]);
  const [loading, setLoading] = useState(false);
  const seededRef = useRef(false);

  // Seed from REST on join (and on reconnect if the room was left)
  useEffect(() => {
    if (!active) return;
    seededRef.current = false;
    let alive = true;
    setLoading(true);
    listSessionPurchases(sessionId)
      .then((page) => {
        if (!alive) return;
        const items = page.items ?? [];
        setFeed(items);
        seededRef.current = true;
      })
      .catch((err) => {
        if (alive) console.warn('[usePurchaseFeed] seed failed', err);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [active, sessionId]);

  // Append from live `sale.resolved` events, dedupe by saleId, cap length
  useEffect(() => {
    if (!active) return undefined;
    return realtime.on('sale.resolved', (payload) => {
      const p = payload as Record<string, unknown> | null;
      if (!p) return;
      const saleId = p['saleId'] as string | undefined;
      if (!saleId) return;
      const purchase: SessionPurchase = {
        saleId,
        productId: (p['productId'] as string) ?? '',
        productTitle: (p['productTitle'] as string) ?? null,
        productImageUrl: (p['productImageUrl'] as string) ?? null,
        mode: (p['mode'] as 'AUCTION' | 'BUY_NOW' | 'OFFER') ?? 'AUCTION',
        currency: (p['currency'] as string) ?? 'USD',
        finalAmount: String(p['finalAmount'] ?? 0),
        winnerUserId: (p['winnerUserId'] as string) ?? '',
        winnerDisplayName: (p['winnerDisplayName'] as string) ?? null,
        resolvedAt: (p['resolvedAt'] as string) ?? new Date().toISOString(),
      };
      setFeed((prev) => {
        if (prev.some((item) => item.saleId === saleId)) return prev;
        const next = [purchase, ...prev];
        return next.length > MAX_FEED_LENGTH ? next.slice(0, MAX_FEED_LENGTH) : next;
      });
    });
  }, [active, realtime.on]);

  // Expose a manual refresh for pull-to-refresh / re-seed
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const page = await listSessionPurchases(sessionId);
      setFeed(page.items ?? []);
      seededRef.current = true;
    } catch (err) {
      console.warn('[usePurchaseFeed] refresh failed', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  return { feed, loading, refresh, seeded: seededRef.current };
}
