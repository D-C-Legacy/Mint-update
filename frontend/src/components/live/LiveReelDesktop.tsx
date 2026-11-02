import * as tokens from '../../theme';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText, Button, Field, Photo, Sheet } from '../ui';
import { colors as c, formatUSD, radii, spacing } from '../../theme';
import { ROUTES } from '../../constants/routes';
import { APP_WEB_URL } from '../../constants/app';
import { shareStream } from '../../lib/share';
import { useApp } from '../../context';
import { useLiveReel } from '../../hooks/useLiveReel';
import type { StreamSession } from '../../api/streams';
import {
  followChannel,
  getChannelById,
  isFollowing,
  unfollowChannel,
  type ChannelSummary,
} from '../../api/channels';
import { CONDITION_LABELS } from '../../api/catalog';
import { describeApiError } from '../../api/describe-error';
import { stockImageFor } from '../../utils/stock-image';
import { useLiveChat } from '../../hooks/useLiveChat';
import { usePurchaseFeed } from '../../hooks/usePurchaseFeed';
import { ReelVideo } from './ReelVideo';
import { LiveSellerHeader } from './LiveSellerHeader';
import { InitialsAvatar } from './InitialsAvatar';
import { WinMoment } from './BidFeedback';
import { LiveWalletSheetContent } from './LiveWalletSheet';
import { PurchaseTicker } from './PurchaseTicker';

const BID_INCREMENTS = [1, 5, 10, 25] as const;
const SUGGESTED_INCREMENT_DOLLARS = 1;

function remaining(endsAt: string | null, now: number): string {
  if (!endsAt) return '';
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

// Desktop-only. Same real session, same `useLiveReel` hook and the same bid/buy handlers as the
// app's `LiveReel` — only the layout differs, Instagram-Live-style: the video fills the left
// column, a fixed-width light panel on the right carries the product/bid block, the chat list,
// and a docked chat input, instead of the mobile overlay-on-video treatment. The app's own
// `LiveReel`/`LiveChatOverlay`/`LiveProductPanel` stay untouched (they're styled white-on-video,
// which doesn't carry over to a light panel background) — this is a parallel, not a replacement.
export function LiveReelDesktop({ session, active }: { session: StreamSession; active: boolean }) {
  const app = useApp();
  const live = useLiveReel(session, active);
  const { product, sale } = live;
  const chat = useLiveChat(session, active);
  const { feed: purchaseFeed } = usePurchaseFeed(session.id, active);
  const [sheet, setSheet] = useState('');
  const [custom, setCustom] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  // Sound starts off, same reasoning LiveMobileShell already documents for web: browsers block
  // autoplay-with-sound until the viewer has interacted with the page. Desktop had no control to
  // turn it back on at all before this (founder feedback, round5) — `muted={false}` was hardcoded.
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [channel, setChannel] = useState<ChannelSummary | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const chatList = useRef<ScrollView>(null);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    getChannelById(session.channelId)
      .then(async (found) => {
        if (!alive || !found) return;
        setChannel(found);
        const follows = await isFollowing(found.id).catch(() => false);
        if (alive) setFollowing(follows);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [active, session.channelId]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    chatList.current?.scrollToEnd({ animated: true });
  }, [chat.messages]);

  async function toggleFollow() {
    if (!channel || followBusy) return;
    setFollowBusy(true);
    try {
      if (following) {
        await unfollowChannel(channel.id);
        setFollowing(false);
      } else {
        await followChannel(channel.id);
        setFollowing(true);
      }
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setFollowBusy(false);
    }
  }

  function sendChat() {
    if (!chatDraft.trim()) return;
    chat.send(chatDraft);
    setChatDraft('');
  }

  const minimumDollars =
    sale?.mode === 'AUCTION'
      ? (sale.currentAmount ?? sale.startAmount ?? 0) / 100 + SUGGESTED_INCREMENT_DOLLARS
      : null;

  const open = sale?.status === 'OPEN';
  const current = sale
    ? sale.mode === 'AUCTION'
      ? (sale.currentAmount ?? sale.startAmount)
      : sale.price
    : null;
  const currentDollars = current === null ? null : current / 100;
  const timer = sale?.mode === 'AUCTION' ? remaining(sale.endsAt, now) : '';
  const ended =
    !!sale &&
    sale.mode === 'AUCTION' &&
    sale.endsAt !== null &&
    new Date(sale.endsAt).getTime() <= now;

  return (
    <View style={styles.row}>
      <View style={styles.video}>
        {live.playbackUrl ? (
          <ReelVideo
            source={live.playbackUrl}
            active={active}
            muted={muted}
            volume={volume}
            flash={0}
          />
        ) : session.thumbnailUrl ? (
          <Photo uri={session.thumbnailUrl} style={StyleSheet.absoluteFillObject} />
        ) : null}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: tokens.colors.mediaShade }]}
        />
        <View style={styles.videoOverlay} pointerEvents="box-none">
          {channel ? (
            <LiveSellerHeader
              name={channel.name}
              avatarUri={channel.bannerUrl ?? stockImageFor(channel.id)}
              viewerCount={live.viewerCount}
              following={following}
              followBusy={followBusy}
              onSeller={() => app.navigate(ROUTES.SELLER, channel.slug)}
              onFollow={toggleFollow}
            />
          ) : null}
          {live.winMoment && sale?.mode === 'AUCTION' ? (
            <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
              <WinMoment data={live.winMoment} />
            </View>
          ) : null}
          <View style={styles.actionRail}>
            <View style={[styles.actionChip, styles.volumeChip]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={muted ? 'Unmute' : 'Mute'}
                onPress={() => setMuted((m) => !m)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Feather name={muted ? 'volume-x' : 'volume-2'} size={14} color="#FFFFFF" />
              </Pressable>
              <VolumeSlider
                value={muted ? 0 : volume}
                onChange={(v) => {
                  setVolume(v);
                  setMuted(v === 0);
                }}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share this show"
              onPress={() => void shareStream({ title: session.title, url: APP_WEB_URL })}
              style={({ pressed }) => [styles.actionChip, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="share-2" size={14} color="#FFFFFF" />
              <AppText white bold size={12}>
                Share
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open wallet"
              onPress={() => setSheet('wallet')}
              style={({ pressed }) => [styles.actionChip, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="credit-card" size={14} color="#FFFFFF" />
              <AppText white bold size={12}>
                Wallet
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Shop this product"
              onPress={() => setSheet(product ? 'product' : '')}
              style={({ pressed }) => [styles.actionChip, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="shopping-bag" size={14} color="#FFFFFF" />
              <AppText white bold size={12}>
                Shop
              </AppText>
            </Pressable>
          </View>
          {live.winMoment && (sale?.mode === 'BUY_NOW' || sale?.mode === 'OFFER') ? (
            <View style={styles.purchaseRow}>
              <WinMoment data={live.winMoment} />
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.panel}>
        {session.title ? (
          <View style={styles.titleBlock}>
            <AppText bold size={16} numberOfLines={1}>
              {session.title}
            </AppText>
          </View>
        ) : null}
        {product && sale ? (
          <View style={styles.productBlock}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open live product details"
              onPress={() => setSheet('product')}
              style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}
            >
              <Photo
                uri={product.images[0]?.url ?? stockImageFor(product.id)}
                style={{ width: 48, height: 48, borderRadius: radii.image }}
              />
              <View style={{ flex: 1 }}>
                <AppText bold size={15} numberOfLines={1}>
                  {product.title}
                </AppText>
                <AppText muted size={12}>
                  {CONDITION_LABELS[product.condition]}
                </AppText>
              </View>
              {currentDollars !== null && (
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText bold size={18} style={{ fontVariant: ['tabular-nums'] }}>
                    {formatUSD(currentDollars)}
                  </AppText>
                  {!!timer && (
                    <AppText bold size={12} style={{ color: ended ? c.urgent : c.textSecondary }}>
                      {ended ? 'ENDING' : timer}
                    </AppText>
                  )}
                </View>
              )}
            </Pressable>

            {live.outbidNotice || live.featuredNotice || live.offerResponseNotice ? (
              <AppText bold size={12} style={{ color: c.urgent }}>
                {live.outbidNotice ?? live.featuredNotice ?? live.offerResponseNotice}
              </AppText>
            ) : open && sale.mode === 'AUCTION' && live.leaderName ? (
              <AppText bold size={12} muted>
                {live.leading ? "You're leading" : `${live.leaderName} is leading`}
              </AppText>
            ) : null}

            {!open ? (
              // Founder feedback (round5, msg 4): same constant-button treatment as
              // LiveProductPanel.tsx's mobile equivalent — once an item has been featured, this
              // stays a single button shape through its whole lifecycle rather than falling back
              // to plain text once it closes.
              <Button label={sale.status === 'RESOLVED' ? 'Sold' : 'Ended'} disabled onPress={() => {}} />
            ) : sale.mode === 'BUY_NOW' ? (
              <Button
                label={
                  currentDollars !== null ? `Buy now · ${formatUSD(currentDollars)}` : 'Buy now'
                }
                onPress={() => live.buyNow()}
              />
            ) : sale.mode === 'OFFER' ? (
              <Button
                label="Make an offer"
                onPress={() => {
                  setCustom('');
                  setSheet('offer');
                }}
              />
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Custom bid"
                  onPress={() => {
                    setCustom(minimumDollars !== null ? String(minimumDollars) : '');
                    setSheet('custom');
                  }}
                  style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <AppText bold size={13}>
                    Custom Bid
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Place bid"
                  disabled={ended}
                  onPress={() => {
                    setCustom(minimumDollars !== null ? String(minimumDollars) : '');
                    setSheet('confirm');
                  }}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { opacity: ended ? 0.5 : pressed ? 0.85 : 1 },
                  ]}
                >
                  <AppText bold size={14} style={{ color: '#FFFFFF' }}>
                    {ended ? 'ENDED' : 'Place a bid'}
                  </AppText>
                </Pressable>
              </View>
            )}
            {live.spinNotice ? (
              <AppText bold size={12} style={{ color: c.urgent }}>
                {live.spinNotice}
              </AppText>
            ) : null}
            {live.loadError ? (
              <AppText muted size={13}>
                {live.loadError}
              </AppText>
            ) : null}
          </View>
        ) : (
          <View style={styles.productBlock}>
            <AppText bold size={14} muted>
              {live.everFeatured ? 'Awaiting next item' : "Auction hasn't started"}
            </AppText>
            {live.spinNotice ? (
              <AppText bold size={12} style={{ color: c.urgent }}>
                {live.spinNotice}
              </AppText>
            ) : null}
            {live.loadError ? (
              <AppText muted size={13}>
                {live.loadError}
              </AppText>
            ) : null}
          </View>
        )}

        {purchaseFeed.length > 0 && (
          <View style={styles.tickerContainer}>
            <AppText bold size={12} style={{ color: c.textSecondary, marginBottom: spacing.xs }}>
              Recent buyers
            </AppText>
            <PurchaseTicker purchases={purchaseFeed} />
          </View>
        )}

        <View style={styles.chatHeader}>
          <AppText bold size={13}>
            Live chat
          </AppText>
        </View>
        <ScrollView
          ref={chatList}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        >
          {chat.messages.length === 0 ? (
            <AppText muted size={13}>
              No messages yet. Say hi.
            </AppText>
          ) : null}
          {chat.messages.map((comment) => (
            <View
              key={comment.id}
              style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}
            >
              <InitialsAvatar name={comment.displayName} size={26} />
              <View style={{ flex: 1 }}>
                <AppText bold size={12}>
                  {comment.displayName}
                </AppText>
                <AppText size={13}>{comment.body}</AppText>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.chatInputRow}>
          <TextInput
            value={chatDraft}
            onChangeText={setChatDraft}
            onSubmitEditing={sendChat}
            placeholder="Say something…"
            placeholderTextColor={c.textSecondary}
            style={styles.chatInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={!chatDraft.trim()}
            onPress={sendChat}
            style={({ pressed }) => [
              styles.sendBtn,
              { opacity: !chatDraft.trim() ? 0.4 : pressed ? 0.8 : 1 },
            ]}
          >
            <AppText bold size={13} style={{ color: '#FFFFFF' }}>
              Send
            </AppText>
          </Pressable>
        </View>
      </View>

      <Sheet visible={sheet === 'confirm'} title="Make it yours" onClose={() => setSheet('')}>
        {product ? (
          <>
            <Photo
              uri={product.images[0]?.url ?? stockImageFor(product.id)}
              style={{ width: '100%', height: 160, borderRadius: tokens.radii.card }}
            />
            <AppText size={20} bold>
              {product.title}
            </AppText>
          </>
        ) : null}
        <AppText muted>Your bid</AppText>
        <AppText size={40} bold>
          {custom ? formatUSD(Number(custom)) : ''}
        </AppText>
        {live.actionError ? (
          <AppText style={{ color: tokens.colors.live }}>{live.actionError}</AppText>
        ) : null}
        <Button
          label={custom ? `Confirm ${formatUSD(Number(custom))}` : 'Confirm'}
          loading={live.busy}
          disabled={!Number(custom)}
          onPress={async () => {
            await live.placeBid(Number(custom));
            setSheet('');
          }}
        />
      </Sheet>

      <Sheet visible={sheet === 'custom'} title="Your custom bid" onClose={() => setSheet('')}>
        <Field
          label="Bid amount (USD)"
          value={custom}
          onChange={setCustom}
          keyboardType="numeric"
        />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {BID_INCREMENTS.map((v) => (
            <Pressable
              key={v}
              style={{
                paddingHorizontal: tokens.spacing.md,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: c.softCanvas,
              }}
              onPress={() => setCustom((prev) => String((Number(prev) || 0) + v))}
            >
              <AppText size={12}>+{formatUSD(v)}</AppText>
            </Pressable>
          ))}
        </View>
        {live.actionError ? (
          <AppText style={{ color: tokens.colors.live }}>{live.actionError}</AppText>
        ) : null}
        <Button
          label={`Place bid ${formatUSD(Number(custom) || 0)}`}
          loading={live.busy}
          disabled={!Number(custom)}
          onPress={async () => {
            await live.placeBid(Number(custom));
            setSheet('');
          }}
        />
      </Sheet>

      <Sheet visible={sheet === 'offer'} title="Make an offer" onClose={() => setSheet('')}>
        {product ? (
          <>
            <Photo
              uri={product.images[0]?.url ?? stockImageFor(product.id)}
              style={{ width: '100%', height: 160, borderRadius: tokens.radii.card }}
            />
            <AppText size={20} bold>
              {product.title}
            </AppText>
          </>
        ) : null}
        <Field
          label="Your offer (USD)"
          value={custom}
          onChange={setCustom}
          keyboardType="numeric"
        />
        <AppText muted size={12}>
          The seller can accept, decline, or send back a counter offer.
        </AppText>
        {live.actionError ? (
          <AppText style={{ color: tokens.colors.live }}>{live.actionError}</AppText>
        ) : null}
        <Button
          label={custom ? `Send offer · ${formatUSD(Number(custom))}` : 'Send offer'}
          loading={live.busy}
          disabled={!Number(custom)}
          onPress={async () => {
            await live.submitOffer(Number(custom));
            setSheet('');
          }}
        />
      </Sheet>

      <Sheet visible={sheet === 'product'} title="The details" onClose={() => setSheet('')}>
        {product ? (
          <>
            <Photo
              uri={product.images[0]?.url ?? stockImageFor(product.id)}
              style={{ width: '100%', height: 190, borderRadius: tokens.radii.card }}
            />
            <AppText size={24} bold>
              {product.title}
            </AppText>
            <AppText bold>{CONDITION_LABELS[product.condition]}</AppText>
            {product.description ? <AppText muted>{product.description}</AppText> : null}
            <Button
              label="View full product"
              onPress={() => {
                setSheet('');
                app.navigate(ROUTES.PRODUCT, product.id);
              }}
            />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={sheet === 'wallet'} title="Wallet" onClose={() => setSheet('')}>
        <LiveWalletSheetContent
          onManage={() => {
            setSheet('');
            app.navigate(ROUTES.PAYMENTS);
          }}
        />
      </Sheet>
    </View>
  );
}

// A real <input type="range">, not a custom-drawn slider — this screen only ever renders on web
// (reached via Live.web.tsx), and this repo has no DOM JSX intrinsics wired up, so the element is
// created imperatively, same pattern ReelVideo.web.tsx already uses for its own <video> element.
function VolumeSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const containerRef = useRef<View>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const container = containerRef.current as unknown as HTMLDivElement | null;
    if (!container) return;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.01';
    input.value = String(value);
    input.style.width = '72px';
    // Default range-input styling is near-invisible on this chip's dark background.
    input.style.accentColor = '#FFFFFF';
    input.addEventListener('input', () => onChange(Number(input.value)));
    container.appendChild(input);
    inputRef.current = input;
    return () => {
      container.removeChild(input);
      inputRef.current = null;
    };
    // Mounted once; live updates to `value` (e.g. muting via the icon) are pushed in the effect
    // below instead of here, so dragging isn't interrupted by a resubscribe mid-drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (inputRef.current && Number(inputRef.current.value) !== value) {
      inputRef.current.value = String(value);
    }
  }, [value]);

  return <View ref={containerRef} style={{ width: 72, height: 20, justifyContent: 'center' }} />;
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: c.canvas,
  },
  video: {
    flex: 1.4,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: spacing.xl,
  },
  panel: {
    width: 380,
    borderLeftWidth: 1,
    borderLeftColor: c.line,
    backgroundColor: c.canvas,
  },
  titleBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  productBlock: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  chatHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  secondaryBtn: {
    flex: 1,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    flex: 1,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRail: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 34,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  volumeChip: {
    gap: spacing.sm,
  },
  purchaseRow: {
    position: 'absolute',
    left: spacing.xl,
    bottom: spacing.xl,
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
  chatInput: {
    flex: 1,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: spacing.lg,
    fontSize: 13,
    color: c.text,
  },
  sendBtn: {
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickerContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
});
