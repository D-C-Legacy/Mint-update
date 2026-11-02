import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtime } from './useRealtime';
import { getProduct, type PublicProduct, type SaleMode } from '../api/catalog';
import { buyNow, getSale, listMyBids, placeBid, submitOffer, type SaleDetail } from '../api/sales';
import { getViewerToken, type CurrentItem, type StreamSession } from '../api/streams';
import {
  applySaleCancelled,
  applySaleExtended,
  applySaleResolved,
  applySaleUpdated,
  offerResponseMessage,
  outbidMessage,
} from '../realtime/sale-events';
import { describeApiError } from '../api/describe-error';

// How long an ephemeral notice stays on screen before clearing itself.
const OUTBID_NOTICE_MS = 4000;
const FEATURED_NOTICE_MS = 3200;
const WHEEL_SPIN_NOTICE_MS = 2500;
const OFFER_RESPONSE_NOTICE_MS = 4000;
const WIN_MOMENT_MS = 5000;

export type WinMoment = { winnerName: string; finalAmount: number; mode: SaleMode };

function obj(payload: unknown): Record<string, unknown> | null {
  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)
    : null;
}

// Everything one live reel needs once it is the one on screen: a real HLS playback URL, the
// currently-featured item (room.state on join, queue.item-featured mid-stream), that item's sale
// kept current by the same WS events SaleActions.tsx already uses, and the bid-feedback state the
// founder asked for (a single leader indicator, an outbid notice, and a win/purchase moment) —
// never a scrolling bid feed. Only runs its WS subscriptions and HTTP calls while `active`, so
// off-screen reels in the feed cost nothing.
export function useLiveReel(session: StreamSession, active: boolean) {
  const realtime = useRealtime();
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(session.viewerCount);
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [sale, setSale] = useState<SaleDetail | null>(null);
  // Whether anything has ever been featured on this session yet — drives which empty-state copy
  // shows when nothing's currently featured ("Auction hasn't started" vs "Awaiting next item").
  // Server-authoritative (`room.state`'s own `hasFeaturedBefore`, `streaming.gateway.ts`) so a
  // viewer who joins mid-stream between items gets the right label, not just this client's own
  // in-session history; the `product`-watching effect below is a same-session head start so it
  // doesn't wait on the next `room.state` round trip once this viewer has already seen one.
  const [everFeatured, setEverFeatured] = useState(false);
  const [leaderName, setLeaderName] = useState<string | null>(null);
  const [leading, setLeading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [outbidNotice, setOutbidNotice] = useState<string | null>(null);
  const [featuredNotice, setFeaturedNotice] = useState<string | null>(null);
  const [spinNotice, setSpinNotice] = useState<string | null>(null);
  const [offerResponseNotice, setOfferResponseNotice] = useState<string | null>(null);
  const [winMoment, setWinMoment] = useState<WinMoment | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const saleIdRef = useRef<string | null>(null);
  const saleModeRef = useRef<SaleMode>('AUCTION');
  // The buyer's own most recent offer on the currently-featured sale — same precedent
  // SaleActions.tsx uses to key `offer.responded` events to the offer that was actually sent,
  // not just the sale (a sale can have many buyers' offers in flight).
  const offerIdRef = useRef<string | null>(null);

  useEffect(() => {
    saleIdRef.current = sale?.id ?? null;
    if (sale) saleModeRef.current = sale.mode;
  }, [sale?.id, sale?.mode]);

  useEffect(() => {
    if (product) setEverFeatured(true);
  }, [product]);

  // Be in the room for exactly as long as this reel is on screen.
  useEffect(() => {
    if (!active) return undefined;
    return realtime.joinRoom(session.id);
  }, [active, realtime.joinRoom, session.id]);

  // Real HLS playback, fetched once per reel the first time it becomes active.
  useEffect(() => {
    if (!active || playbackUrl) return;
    let alive = true;
    getViewerToken(session.id)
      .then((access) => {
        if (alive) setPlaybackUrl(access.viewerToken.playbackUrl);
      })
      .catch((err) => {
        if (alive) setLoadError(describeApiError(err));
      });
    return () => {
      alive = false;
    };
  }, [active, session.id, playbackUrl]);

  const loadItem = useCallback(async (item: CurrentItem | null) => {
    offerIdRef.current = null;
    if (!item) {
      setProduct(null);
      setSale(null);
      setLeaderName(null);
      return;
    }
    try {
      const [productDetail, saleDetail] = await Promise.all([
        getProduct(item.productId),
        getSale(item.saleId),
      ]);
      setProduct(productDetail);
      setSale(saleDetail);
      if (saleDetail.mode === 'AUCTION' && saleDetail.currentBidId) {
        const mine = await listMyBids().catch(() => null);
        setLeading(mine ? mine.items.some((bid) => bid.id === saleDetail.currentBidId) : false);
      } else {
        setLeading(false);
      }
    } catch (err) {
      setLoadError(describeApiError(err));
    }
  }, []);

  // room.state arrives once per join (and once per each reconnect) with whatever is already
  // featured — the gap founder_requests.md §3 flagged (a viewer joining mid-sale used to see
  // nothing until the next bid).
  useEffect(() => {
    if (!active) return undefined;
    return realtime.on('room.state', (payload) => {
      const p = obj(payload);
      const sessionField = obj(p?.['session']);
      if (!p || sessionField?.['id'] !== session.id) return;
      const raw = p['currentItem'];
      void loadItem(raw && typeof raw === 'object' ? (raw as CurrentItem) : null);
      // Authoritative, not just this client's own local history — covers a viewer who joins
      // mid-stream, between items, which a purely client-side "have I personally seen a product
      // yet" flag would get wrong (see `everFeatured`'s own comment above).
      if (p['hasFeaturedBefore'] === true) setEverFeatured(true);
    });
  }, [active, realtime.on, session.id, loadItem]);

  // room.join is rejected (most commonly STREAM_NOT_LIVE — the seller ended the stream between
  // this session appearing in GET /streams/live and the socket catching up) via a WsException,
  // not a room.state reply. Without this, that failure was silent: the panel stayed on "nothing
  // featured" forever with no indication the stream itself was gone.
  useEffect(() => {
    if (!active) return undefined;
    return realtime.on('exception', (payload) => {
      const p = obj(payload);
      const message = p?.['message'];
      if (typeof message === 'string') setLoadError(message);
    });
  }, [active, realtime.on]);

  // A seller featuring a different item mid-stream. The event itself only carries ids
  // (streaming.gateway.ts), so the product and sale are fetched fresh rather than guessed at.
  useEffect(() => {
    if (!active) return undefined;
    return realtime.on('queue.item-featured', (payload) => {
      const p = obj(payload);
      const productId = p?.['productId'];
      const saleId = p?.['saleId'];
      const itemId = p?.['itemId'];
      if (typeof productId !== 'string' || typeof saleId !== 'string') return;
      setFeaturedNotice('Now featuring a new item');
      void loadItem({
        itemId: typeof itemId === 'string' ? itemId : '',
        productId,
        saleId,
        mode: 'AUCTION',
        currentAmount: null,
        price: null,
        endsAt: null,
      });
    });
  }, [active, realtime.on, loadItem]);

  // Keeps the already-loaded sale current — the same events and the same pure appliers
  // SaleActions.tsx already uses for the product page's own bid panel.
  useEffect(() => {
    if (!active) return undefined;
    const off = [
      realtime.on('viewers.count', (payload) => {
        const count = obj(payload)?.['count'];
        if (typeof count === 'number') setViewerCount(count);
      }),
      realtime.on('sale.updated', (payload) => {
        setSale((s) => (s ? applySaleUpdated(s, payload) : s));
        const p = obj(payload);
        if (p?.['saleId'] === saleIdRef.current && typeof p['leaderName'] === 'string') {
          setLeaderName(p['leaderName']);
        }
      }),
      realtime.on('sale.extended', (payload) =>
        setSale((s) => (s ? applySaleExtended(s, payload) : s)),
      ),
      realtime.on('sale.mode-switched', (payload) => {
        const p = obj(payload);
        if (!p || p['saleId'] !== saleIdRef.current) return;
        setSale((s) =>
          s
            ? {
                ...s,
                mode: (p['mode'] as SaleMode | undefined) ?? s.mode,
                currentAmount: typeof p['currentAmount'] === 'number' ? p['currentAmount'] : null,
                price: typeof p['price'] === 'number' ? p['price'] : null,
                endsAt: typeof p['endsAt'] === 'string' ? p['endsAt'] : s.endsAt,
              }
            : s,
        );
      }),
      realtime.on('sale.resolved', (payload) => {
        const p = obj(payload);
        if (p?.['saleId'] !== saleIdRef.current) return;
        setSale((s) => (s ? applySaleResolved(s, payload) : s));
        setWinMoment({
          winnerName: typeof p['winnerName'] === 'string' ? p['winnerName'] : 'Someone',
          finalAmount: typeof p['finalAmount'] === 'number' ? p['finalAmount'] : 0,
          mode: saleModeRef.current,
        });
      }),
      realtime.on('sale.cancelled', (payload) =>
        setSale((s) => (s ? applySaleCancelled(s, payload) : s)),
      ),
      realtime.on('bid.accepted', (payload) => {
        if (obj(payload)?.['saleId'] === saleIdRef.current) setLeading(true);
      }),
      realtime.on('bid.outbid', (payload) => {
        if (!saleIdRef.current) return;
        const text = outbidMessage(saleIdRef.current, payload);
        if (text) {
          setLeading(false);
          setOutbidNotice(text);
        }
      }),
      realtime.on('offer.responded', (payload) => {
        const text = offerResponseMessage(offerIdRef.current, payload);
        if (text) setOfferResponseNotice(text);
      }),
      // Founder "spin the wheel" request (21 Oct 2026) — the seller randomized which PENDING
      // item goes live next. No Sale exists yet (that's what the later queue.item-featured is
      // for), so this is purely a transient "something's happening" notice, same shape as
      // featuredNotice above.
      realtime.on('queue.wheel-spun', () => {
        setSpinNotice('Seller is spinning the wheel…');
      }),
    ];
    return () => off.forEach((fn) => fn());
    // Every handler reads sale state through saleIdRef/saleModeRef, so this effect never needs to
    // resubscribe when the sale itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, realtime.on]);

  useEffect(() => {
    if (!outbidNotice) return;
    const t = setTimeout(() => setOutbidNotice(null), OUTBID_NOTICE_MS);
    return () => clearTimeout(t);
  }, [outbidNotice]);

  useEffect(() => {
    if (!featuredNotice) return;
    const t = setTimeout(() => setFeaturedNotice(null), FEATURED_NOTICE_MS);
    return () => clearTimeout(t);
  }, [featuredNotice]);

  useEffect(() => {
    if (!spinNotice) return;
    const t = setTimeout(() => setSpinNotice(null), WHEEL_SPIN_NOTICE_MS);
    return () => clearTimeout(t);
  }, [spinNotice]);

  useEffect(() => {
    if (!offerResponseNotice) return;
    const t = setTimeout(() => setOfferResponseNotice(null), OFFER_RESPONSE_NOTICE_MS);
    return () => clearTimeout(t);
  }, [offerResponseNotice]);

  useEffect(() => {
    if (!winMoment) return;
    const t = setTimeout(() => setWinMoment(null), WIN_MOMENT_MS);
    return () => clearTimeout(t);
  }, [winMoment]);

  const run = useCallback(async (action: () => Promise<unknown>, notice: string) => {
    setBusy(true);
    setActionError('');
    setActionNotice('');
    try {
      await action();
      setActionNotice(notice);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const doPlaceBid = useCallback(
    (dollars: number) => sale && run(() => placeBid(sale.id, dollars), 'Bid placed'),
    [sale, run],
  );
  const doBuyNow = useCallback(
    () => sale && run(() => buyNow(sale.id), 'Purchase placed'),
    [sale, run],
  );
  const doSubmitOffer = useCallback(
    (dollars: number) =>
      sale &&
      run(async () => {
        const result = await submitOffer(sale.id, dollars);
        offerIdRef.current = result.offerId;
      }, 'Offer sent'),
    [sale, run],
  );

  return {
    connected: realtime.status === 'connected' && realtime.joinedRooms.has(session.id),
    playbackUrl,
    viewerCount,
    product,
    sale,
    everFeatured,
    leaderName,
    leading,
    loadError,
    outbidNotice,
    featuredNotice,
    spinNotice,
    offerResponseNotice,
    winMoment,
    busy,
    actionError,
    actionNotice,
    placeBid: doPlaceBid,
    buyNow: doBuyNow,
    submitOffer: doSubmitOffer,
  };
}
