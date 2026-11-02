import * as tokens from '../../theme';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import {
  AppText,
  Badge,
  Button,
  Field,
  Icon,
  MenuRow,
  Screen,
  Section,
  Sheet,
  s,
} from '../../components';
import { colors as c, formatUSD } from '../../theme';
import { useApp } from '../../context';
import { useRealtime } from '../../hooks';
import { getMySeller } from '../../api/seller';
import { listMyProducts, type SellerProduct } from '../../api/seller-products';
import { listChannels } from '../../api/channels';
import {
  addQueueItem,
  createStream,
  endStream,
  featureQueueItem,
  getStreamSession,
  listLiveStreams,
  listQueue,
  reorderQueueItems,
  setAutoQueueEnabled,
  spinQueueWheel,
  startStream,
  type PublisherAccess,
  type QueueItem,
  type QueueItemMode,
  type StreamSession,
} from '../../api/streams';
import { getSale, switchSaleMode, toMinor, type SaleDetail } from '../../api/sales';
import {
  applySaleCancelled,
  applySaleExtended,
  applySaleResolved,
  applySaleUpdated,
} from '../../realtime/sale-events';
import { describeApiError } from '../../api/describe-error';
import { ApiError, ErrorCodes } from '../../api';
import { PrizeWheel } from '../../components/live/PrizeWheel';

// Finds a session this seller already has live, so reopening this screen (or a page reload)
// resumes it instead of offering "Go live" again on top of an already-running show. There's no
// "my current session" route, so this reads the same way a viewer would: the seller's one channel,
// then whichever live session belongs to it.
async function findMyLiveSession(sellerId: string): Promise<StreamSession | null> {
  const channels = await listChannels({ sellerId });
  const channel = channels.items[0];
  if (!channel) return null;
  const live = await listLiveStreams();
  return live.items.find((session) => session.channelId === channel.id) ?? null;
}

function obj(payload: unknown): Record<string, unknown> | null {
  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)
    : null;
}

async function copyText(
  app: ReturnType<typeof useApp>,
  label: string,
  value: string,
): Promise<void> {
  try {
    if (Platform.OS === 'web' && navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      app.toast(`${label} copied`);
      return;
    }
  } catch {
    // falls through to the manual-copy toast below
  }
  app.toast(`Select the ${label.toLowerCase()} below to copy it`);
}

// The portal's Go-live pane hosts `ControlRoom` bare (no Screen chrome — the pane supplies the
// header and scroll); the mobile app and the standalone web route keep the full Screen shell.
// Defined at module scope, not inside `ControlRoom`, so its identity stays stable across renders —
// nested inside the component it used to remount on every state change (every keystroke in the
// title field included it), dropping the input's focus and eating every character after the first.
function Shell({
  bare,
  title,
  onBack,
  children,
}: {
  bare: boolean;
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return bare ? (
    <>{children}</>
  ) : (
    <Screen title={title} onBack={onBack}>
      {children}
    </Screen>
  );
}

export function ControlRoom({ bare = false }: { bare?: boolean } = {}) {
  const app = useApp();
  const realtime = useRealtime();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<StreamSession | null>(null);
  const [publisher, setPublisher] = useState<PublisherAccess | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [sale, setSale] = useState<SaleDetail | null>(null);

  const [sheet, setSheet] = useState<'' | 'add' | 'feature' | 'switch'>('');
  const [addTarget, setAddTarget] = useState<SellerProduct | null>(null);
  const [featureTarget, setFeatureTarget] = useState<QueueItem | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [autoQueueBusy, setAutoQueueBusy] = useState(false);
  const [wheelTarget, setWheelTarget] = useState<string | null>(null);
  const [formAmount, setFormAmount] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formMode, setFormMode] = useState<QueueItemMode>('BUY_NOW');

  useEffect(() => {
    (async () => {
      try {
        const mySeller = await getMySeller();
        if (mySeller) {
          const existing = await findMyLiveSession(mySeller.id);
          if (existing) setSession(existing);
        }
      } catch (err) {
        setError(describeApiError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    listMyProducts({ limit: 100 })
      .then((page) => setProducts(page.items))
      .catch(() => undefined);
  }, []);

  const refreshQueue = useCallback(async () => {
    if (!session) return;
    try {
      const page = await listQueue(session.id);
      setQueue(page.items);
    } catch (err) {
      setError(describeApiError(err));
    }
  }, [session]);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  const activeItem = queue.find((item) => item.status === 'ACTIVE') ?? null;

  useEffect(() => {
    if (!activeItem?.saleId) {
      setSale(null);
      return;
    }
    let alive = true;
    getSale(activeItem.saleId)
      .then((detail) => {
        if (alive) setSale(detail);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [activeItem?.saleId]);

  // Stay in the room while managing the show, so the featured item's sale (bids, mode switches)
  // stays current without re-polling.
  useEffect(() => {
    if (!session) return undefined;
    return realtime.joinRoom(session.id);
  }, [session?.id, realtime.joinRoom]);

  useEffect(() => {
    if (!sale) return undefined;
    const off = [
      realtime.on('sale.updated', (p) => setSale((s2) => (s2 ? applySaleUpdated(s2, p) : s2))),
      realtime.on('sale.extended', (p) => setSale((s2) => (s2 ? applySaleExtended(s2, p) : s2))),
      realtime.on('sale.resolved', (p) => {
        setSale((s2) => (s2 ? applySaleResolved(s2, p) : s2));
        void refreshQueue();
      }),
      realtime.on('sale.cancelled', (p) => setSale((s2) => (s2 ? applySaleCancelled(s2, p) : s2))),
    ];
    return () => off.forEach((fn) => fn());
  }, [sale?.id, realtime.on, refreshQueue]);

  // Founder "spin the wheel" request (21 Oct 2026): the server already picked the item (see
  // SpinQueueWheelUseCase). This used to jump straight to the "Feature" sheet on the broadcast;
  // now it drives a real spin animation (`PrizeWheel`) that lands on the already-known pick, and
  // only opens the Feature sheet once that animation finishes — see `wheelTarget` below.
  useEffect(() => {
    if (!session) return undefined;
    return realtime.on('queue.wheel-spun', (payload) => {
      const itemId = obj(payload)?.['itemId'];
      if (typeof itemId !== 'string') return;
      setWheelTarget(itemId);
    });
  }, [session?.id, realtime.on]);

  // Fires once the wheel's own spin animation lands on `wheelTarget` — or immediately, if the
  // seller closes the wheel sheet before it finishes, so an early dismiss still surfaces the real
  // pick instead of silently dropping it.
  function finishWheelSpin() {
    const itemId = wheelTarget;
    setWheelTarget(null);
    if (!itemId) return;
    const item = queue.find((q) => q.id === itemId);
    if (item) {
      app.toast(`Wheel landed on "${productTitle(item.productId)}"`);
      openFeature(item);
    }
  }

  async function goLive() {
    if (!title.trim()) {
      setError('Give your show a title.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await createStream(title.trim());
      const access = await startStream(created.sessionId);
      setPublisher(access);
      setSession(await getStreamSession(created.sessionId));
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function endShow() {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      await endStream(session.id);
    } catch (err) {
      // The session can end on its own (stream-reconcile.processor.ts, no real video arriving) —
      // if that already happened, the seller's intent ("stop managing this show") is already true,
      // so clear local state instead of leaving them stuck on a dead session with no way out.
      if (!(err instanceof ApiError && err.code === ErrorCodes.INVALID_STREAM_STATUS)) {
        setError(describeApiError(err));
        setBusy(false);
        return;
      }
    }
    setSession(null);
    setPublisher(null);
    setQueue([]);
    setSale(null);
    setBusy(false);
  }

  // Step 1 of "Add to the queue": pick a product. Step 2 (openAdd/submitAdd) collects the actual
  // mode + price/quantity up front now (round5 §5, 26 Oct 2026) — previously this added the item
  // immediately with a throwaway hardcoded BUY_NOW mode and left pricing entirely for feature-time,
  // which works for a seller manually tapping "Feature" but leaves nothing for an automatic advance
  // to use. The Feature sheet still lets the seller override these at feature-time; this just sets
  // real defaults instead of starting blank.
  function openAdd(product: SellerProduct) {
    setAddTarget(product);
    setFormMode('BUY_NOW');
    setFormAmount('');
    setFormQuantity('1');
    setError('');
  }

  async function submitAdd() {
    if (!session || !addTarget) return;
    const amount = Number(formAmount);
    if (formMode !== 'OFFER' && !amount) {
      setError('Enter an amount.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await addQueueItem(
        session.id,
        addTarget.id,
        formMode === 'AUCTION'
          ? { mode: 'AUCTION', startAmount: toMinor(amount) }
          : formMode === 'BUY_NOW'
            ? { mode: 'BUY_NOW', price: toMinor(amount), quantity: Number(formQuantity) || 1 }
            : { mode: 'OFFER' },
      );
      await refreshQueue();
      setAddTarget(null);
      setSheet('');
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  }

  // Founder-feedback round5 §5: "sellers can pause and start the queue" — a per-show toggle, not a
  // seller-level default (resets to off every new session, same as the rest of go-live state).
  async function toggleAutoQueue() {
    if (!session) return;
    setAutoQueueBusy(true);
    setError('');
    try {
      const result = await setAutoQueueEnabled(session.id, !session.autoQueueEnabled);
      setSession({ ...session, autoQueueEnabled: result.autoQueueEnabled });
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setAutoQueueBusy(false);
    }
  }

  async function move(item: QueueItem, direction: -1 | 1) {
    if (!session) return;
    const idx = queue.findIndex((q) => q.id === item.id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= queue.length) return;
    const next = [...queue];
    const tmp = next[idx]!;
    next[idx] = next[swapIdx]!;
    next[swapIdx] = tmp;
    setQueue(next);
    try {
      await reorderQueueItems(
        session.id,
        next.map((q) => q.id),
      );
    } catch (err) {
      setError(describeApiError(err));
      void refreshQueue();
    }
  }

  async function spinWheel() {
    if (!session) return;
    setSpinning(true);
    setError('');
    try {
      await spinQueueWheel(session.id);
      // The feature sheet opens from the queue.wheel-spun subscription above, not from this
      // response — that's the one source of truth every client (including this one) reacts to,
      // so a slow/duplicate HTTP response can't open it twice.
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSpinning(false);
    }
  }

  function openFeature(item: QueueItem) {
    setFeatureTarget(item);
    setFormMode(item.mode);
    // Pre-filled from what was entered at add-to-queue time (round5 §5) — still editable, not
    // locked in, same as before this change just starting from a real default instead of blank.
    setFormAmount(
      item.mode === 'AUCTION' && item.startAmount !== null
        ? String(item.startAmount / 100)
        : item.mode === 'BUY_NOW' && item.price !== null
          ? String(item.price / 100)
          : '',
    );
    setFormQuantity(item.quantity !== null ? String(item.quantity) : '1');
    setError('');
    setSheet('feature');
  }

  async function submitFeature() {
    if (!session || !featureTarget) return;
    const amount = Number(formAmount);
    if (formMode !== 'OFFER' && !amount) {
      setError('Enter an amount.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await featureQueueItem(
        session.id,
        featureTarget.id,
        formMode === 'AUCTION'
          ? { mode: 'AUCTION', currency: 'USD', startAmount: toMinor(amount) }
          : formMode === 'BUY_NOW'
            ? {
                mode: 'BUY_NOW',
                currency: 'USD',
                price: toMinor(amount),
                quantity: Number(formQuantity) || 1,
              }
            : { mode: 'OFFER', currency: 'USD' },
      );
      await refreshQueue();
      setSheet('');
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  }

  function openSwitch() {
    if (!sale) return;
    setFormMode(sale.mode);
    setFormAmount('');
    setFormQuantity('1');
    setError('');
    setSheet('switch');
  }

  async function submitSwitch() {
    if (!sale) return;
    const amount = Number(formAmount);
    if (formMode !== 'OFFER' && !amount) {
      setError('Enter an amount.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await switchSaleMode(
        sale.id,
        formMode === 'AUCTION'
          ? { mode: 'AUCTION', startAmount: toMinor(amount) }
          : formMode === 'BUY_NOW'
            ? { mode: 'BUY_NOW', price: toMinor(amount), quantity: Number(formQuantity) || 1 }
            : { mode: 'OFFER' },
      );
      const refreshed = await getSale(sale.id);
      setSale(refreshed);
      setSheet('');
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  }

  function modeLabel(mode: QueueItemMode): string {
    return mode === 'AUCTION' ? 'Auction' : mode === 'BUY_NOW' ? 'Buy now' : 'Offer';
  }

  function productTitle(productId: string): string {
    return products.find((p) => p.id === productId)?.title ?? 'Unknown product';
  }

  if (loading) {
    return (
      <Shell bare={bare} onBack={app.back} title="Go live">
        <AppText muted>Loading…</AppText>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell bare={bare} onBack={app.back} title="Go live">
        <Section title="Start a show" />
        <AppText muted size={13}>
          Broadcasting is via OBS (or any RTMP tool) using the ingest URL and stream key this gives
          you. There's no in-app camera broadcast yet.
        </AppText>
        <Field
          label="Show title"
          value={title}
          onChange={setTitle}
          placeholder="Friday night finds"
        />
        {error ? <AppText style={{ color: tokens.colors.live }}>{error}</AppText> : null}
        <Button label="Go live" loading={busy} disabled={!title.trim()} onPress={goLive} />
      </Shell>
    );
  }

  const queuePosition = (item: QueueItem) => queue.findIndex((q) => q.id === item.id);

  return (
    <Shell bare={bare} onBack={app.back} title="Live control room">
      <View
        style={{
          padding: tokens.spacing.lg,
          backgroundColor: c.ink,
          borderRadius: tokens.radii.cardLarge,
          gap: tokens.spacing.sm,
        }}
      >
        <View style={[s.row, { alignItems: 'center' }]}>
          <Icon name="radio-outline" color={tokens.colors.canvas} size={22} />
          <View style={{ flex: 1, marginLeft: tokens.spacing.sm }}>
            <AppText white bold size={16}>
              {session.title}
            </AppText>
          </View>
          <Badge label="LIVE" color={c.live} />
        </View>
        {publisher ? (
          <View style={{ gap: 4 }}>
            <AppText white size={12} muted>
              Paste these into OBS → Settings → Stream → Custom
            </AppText>
            <MenuRow
              title="Server"
              detail={publisher.publishToken.ingestEndpoint}
              icon="copy-outline"
              onPress={() => copyText(app, 'Server', publisher.publishToken.ingestEndpoint)}
            />
            <MenuRow
              title="Stream key"
              detail="•••• tap to copy"
              icon="copy-outline"
              onPress={() => copyText(app, 'Stream key', publisher.publishToken.streamKey)}
            />
          </View>
        ) : (
          <AppText white size={12} muted>
            Reconnecting to OBS? Your stream key isn't shown again after this page reloads. End this
            show and go live again if you need a fresh one.
          </AppText>
        )}
      </View>

      <Section title="Currently featured" />
      {activeItem && sale ? (
        <View style={[s.card, { gap: tokens.spacing.sm }]}>
          <AppText bold size={16}>
            {productTitle(activeItem.productId)}
          </AppText>
          <AppText muted size={13}>
            {modeLabel(sale.mode)} · {sale.status}
          </AppText>
          <PriceLine sale={sale} />
          <Button
            secondary
            label="Switch mode"
            onPress={openSwitch}
            disabled={sale.status !== 'OPEN'}
          />
        </View>
      ) : (
        <AppText muted>Nothing featured yet. Feature an item from the queue below.</AppText>
      )}

      <Section title="Automatic queue" />
      <View
        style={[
          s.card,
          { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
        ]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <AppText bold size={14}>
            {session.autoQueueEnabled ? 'Running' : 'Paused'}
          </AppText>
          <AppText muted size={12}>
            {session.autoQueueEnabled
              ? "Auto-features the next in-stock item shortly after one ends."
              : 'Off — feature each item yourself.'}
          </AppText>
        </View>
        <Button
          secondary={session.autoQueueEnabled}
          label={session.autoQueueEnabled ? 'Pause' : 'Start'}
          loading={autoQueueBusy}
          onPress={toggleAutoQueue}
        />
      </View>

      <Section title="Queue" action="Add" onPress={() => setSheet('add')} />
      <Button
        secondary
        label="Spin the wheel"
        icon="shuffle-outline"
        loading={spinning}
        disabled={queue.filter((item) => item.status === 'PENDING').length === 0}
        onPress={spinWheel}
      />
      {queue.length === 0 ? (
        <AppText muted>No items queued.</AppText>
      ) : (
        queue.map((item) => (
          <View
            key={item.id}
            style={{
              paddingVertical: tokens.spacing.sm,
              borderBottomWidth: 1,
              borderColor: c.line,
              gap: 4,
            }}
          >
            <View style={[s.row, { alignItems: 'center' }]}>
              <View style={{ flex: 1 }}>
                <AppText bold size={14}>
                  {productTitle(item.productId)}
                </AppText>
                <AppText muted size={12}>
                  {modeLabel(item.mode)}
                  {item.mode === 'AUCTION' && item.startAmount !== null
                    ? ` · ${formatUSD(item.startAmount / 100)} start`
                    : item.mode === 'BUY_NOW' && item.price !== null
                      ? ` · ${formatUSD(item.price / 100)} · qty ${item.quantity ?? 1}`
                      : ''}
                </AppText>
              </View>
              <Badge
                label={item.status}
                color={
                  item.status === 'ACTIVE'
                    ? c.live
                    : item.status === 'DONE'
                      ? c.textSecondary
                      : c.brand
                }
              />
            </View>
            <View style={[s.row, { gap: tokens.spacing.sm }]}>
              <Button
                secondary
                label="↑"
                onPress={() => move(item, -1)}
                disabled={queuePosition(item) === 0}
              />
              <Button
                secondary
                label="↓"
                onPress={() => move(item, 1)}
                disabled={queuePosition(item) === queue.length - 1}
              />
              {item.status === 'PENDING' ? (
                <View style={{ flex: 1 }}>
                  <Button label="Feature" onPress={() => openFeature(item)} />
                </View>
              ) : null}
            </View>
          </View>
        ))
      )}

      {error ? <AppText style={{ color: tokens.colors.live }}>{error}</AppText> : null}
      <Button secondary label="End show" loading={busy} onPress={endShow} />

      <Sheet
        visible={sheet === 'add'}
        title={addTarget ? `Add "${addTarget.title}" to the queue` : 'Add to the queue'}
        onClose={() => {
          setSheet('');
          setAddTarget(null);
        }}
      >
        {!addTarget ? (
          products.filter((p) => !queue.some((q) => q.productId === p.id)).length === 0 ? (
            <AppText muted>Every listing is already queued.</AppText>
          ) : (
            products
              .filter((p) => !queue.some((q) => q.productId === p.id))
              .map((p) => (
                <MenuRow
                  key={p.id}
                  title={p.title}
                  detail={`Qty ${p.quantity - p.reserved}`}
                  icon="add-outline"
                  onPress={() => openAdd(p)}
                />
              ))
          )
        ) : (
          <>
            <ModeToggle value={formMode} onChange={setFormMode} />
            {formMode === 'OFFER' ? (
              <AppText muted size={12}>
                Buyers submit their own offer amount. You accept, reject, or counter each one from
                your seller inbox.
              </AppText>
            ) : (
              <Field
                label={formMode === 'AUCTION' ? 'Starting bid (USD)' : 'Price (USD)'}
                value={formAmount}
                onChange={(v) => setFormAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
              />
            )}
            {formMode === 'BUY_NOW' ? (
              <Field
                label="Quantity"
                value={formQuantity}
                onChange={(v) => setFormQuantity(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
              />
            ) : null}
            {error ? <AppText style={{ color: tokens.colors.live }}>{error}</AppText> : null}
            <Button label="Add to queue" loading={busy} onPress={submitAdd} />
          </>
        )}
      </Sheet>

      <Sheet
        visible={sheet === 'feature'}
        title={featureTarget ? `Feature "${productTitle(featureTarget.productId)}"` : 'Feature'}
        onClose={() => setSheet('')}
      >
        <ModeToggle value={formMode} onChange={setFormMode} />
        {formMode === 'OFFER' ? (
          <AppText muted size={12}>
            Buyers submit their own offer amount. You accept, reject, or counter each one from your
            seller inbox.
          </AppText>
        ) : (
          <Field
            label={formMode === 'AUCTION' ? 'Starting bid (USD)' : 'Price (USD)'}
            value={formAmount}
            onChange={(v) => setFormAmount(v.replace(/[^0-9.]/g, ''))}
            keyboardType="numeric"
          />
        )}
        {formMode === 'BUY_NOW' ? (
          <Field
            label="Quantity"
            value={formQuantity}
            onChange={(v) => setFormQuantity(v.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
          />
        ) : null}
        {error ? <AppText style={{ color: tokens.colors.live }}>{error}</AppText> : null}
        <Button label="Go live with this item" loading={busy} onPress={submitFeature} />
      </Sheet>

      <Sheet visible={sheet === 'switch'} title="Switch mode" onClose={() => setSheet('')}>
        <ModeToggle value={formMode} onChange={setFormMode} />
        {formMode === 'OFFER' ? (
          <AppText muted size={12}>
            Buyers submit their own offer amount. You accept, reject, or counter each one from your
            seller inbox.
          </AppText>
        ) : (
          <Field
            label={formMode === 'AUCTION' ? 'Starting bid (USD)' : 'Price (USD)'}
            value={formAmount}
            onChange={(v) => setFormAmount(v.replace(/[^0-9.]/g, ''))}
            keyboardType="numeric"
          />
        )}
        {formMode === 'BUY_NOW' ? (
          <Field
            label="Quantity"
            value={formQuantity}
            onChange={(v) => setFormQuantity(v.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
          />
        ) : null}
        <AppText muted size={12}>
          Keeps the same sale and its existing bids. This isn't a cancel-and-restart.
        </AppText>
        {error ? <AppText style={{ color: tokens.colors.live }}>{error}</AppText> : null}
        <Button label="Switch" loading={busy} onPress={submitSwitch} />
      </Sheet>

      <Sheet visible={wheelTarget !== null} title="Spinning the wheel…" onClose={finishWheelSpin}>
        <PrizeWheel
          items={queue
            .filter((item) => item.status === 'PENDING')
            .map((item) => ({ id: item.id, label: productTitle(item.productId) }))}
          targetId={wheelTarget}
          spinning={wheelTarget !== null}
          onFinish={finishWheelSpin}
        />
      </Sheet>
    </Shell>
  );
}

function ModeToggle({
  value,
  onChange,
}: {
  value: QueueItemMode;
  onChange: (mode: QueueItemMode) => void;
}) {
  const options: { mode: QueueItemMode; label: string }[] = [
    { mode: 'BUY_NOW', label: 'Buy now' },
    { mode: 'AUCTION', label: 'Auction' },
    { mode: 'OFFER', label: 'Offer' },
  ];
  return (
    <View style={[s.row, { gap: tokens.spacing.sm }]}>
      {options.map((opt) => (
        <Pressable
          key={opt.mode}
          accessibilityRole="button"
          accessibilityState={{ selected: value === opt.mode }}
          onPress={() => onChange(opt.mode)}
          style={{
            paddingHorizontal: tokens.spacing.lg,
            paddingVertical: tokens.spacing.sm,
            borderRadius: tokens.radii.pill,
            backgroundColor: value === opt.mode ? c.brand : c.softCanvas,
          }}
        >
          <AppText bold size={13} style={{ color: value === opt.mode ? '#FFFFFF' : c.text }}>
            {opt.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

function PriceLine({ sale }: { sale: SaleDetail }) {
  if (sale.mode === 'BUY_NOW') {
    return (
      <AppText size={22} bold>
        {sale.price !== null ? formatUSD(sale.price / 100) : 'N/A'}
      </AppText>
    );
  }
  if (sale.mode === 'OFFER') {
    return (
      <AppText muted size={13}>
        Buyers are submitting their own offer amount.
      </AppText>
    );
  }
  const current = sale.currentAmount ?? sale.startAmount;
  return (
    <AppText size={22} bold>
      {current !== null ? formatUSD(current / 100) : 'N/A'}
      <AppText muted size={13}>
        {' '}
        current
      </AppText>
    </AppText>
  );
}
