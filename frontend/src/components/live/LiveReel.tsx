import * as tokens from '../../theme';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText, Button, Field, Photo, Sheet } from '../ui';
import { colors as c, formatUSD } from '../../theme';
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
import { LiveChatOverlay } from './LiveChatOverlay';
import { LiveActionRail } from './LiveActionRail';
import { LiveProductPanel } from './LiveProductPanel';
import { LiveWalletSheetContent } from './LiveWalletSheet';
import { WinMoment } from './BidFeedback';
import { PurchaseTicker } from './PurchaseTicker';

const BID_INCREMENTS = [1, 5, 10, 25] as const;
const SUGGESTED_INCREMENT_DOLLARS = 1;

// One reel in the feed: a real live session. Everything that makes it "live" — video, the
// featured item, the sale, chat preview, bid feedback — lives here, scoped to this one session,
// and only runs while `active` (via useLiveReel). The other reels in the FlatList show just a
// still thumbnail and cost nothing until swiped to.
export function LiveReel({
  session,
  active,
  muted,
  flash,
  barPad,
  onReelTap,
}: {
  session: StreamSession;
  active: boolean;
  muted: boolean;
  flash: number;
  barPad: Animated.Value;
  onReelTap: () => void;
}) {
  const app = useApp();
  const live = useLiveReel(session, active);
  const { product, sale } = live;
  const chat = useLiveChat(session, active);
  const { feed: purchaseFeed } = usePurchaseFeed(session.id, active);
  const [sheet, setSheet] = useState('');
  const [custom, setCustom] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [chatInputActive, setChatInputActive] = useState(false);
  const [channel, setChannel] = useState<ChannelSummary | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Reverts to the idle "Say something…" bubble when this reel is swiped away, so swiping back to
  // it later doesn't reopen the keyboard on its own.
  useEffect(() => {
    if (!active) setChatInputActive(false);
  }, [active]);

  function sendChat() {
    if (!chatDraft.trim()) return;
    chat.send(chatDraft);
    setChatDraft('');
  }

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

  const minimumDollars =
    sale?.mode === 'AUCTION'
      ? (sale.currentAmount ?? sale.startAmount ?? 0) / 100 + SUGGESTED_INCREMENT_DOLLARS
      : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.ink }}>
      {live.playbackUrl ? (
        <ReelVideo source={live.playbackUrl} active={active} muted={muted} flash={flash} />
      ) : (
        <View style={StyleSheet.absoluteFill}>
          {session.thumbnailUrl ? (
            <Photo uri={session.thumbnailUrl} style={StyleSheet.absoluteFillObject} />
          ) : null}
        </View>
      )}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onReelTap}
        accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: tokens.colors.mediaShade }]}
      />
      <Animated.View
        pointerEvents="box-none"
        style={{
          flex: 1,
          padding: tokens.spacing.xl,
          paddingBottom: barPad,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ gap: tokens.spacing.md }}>
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
          <PurchaseTicker purchases={purchaseFeed} />
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {live.winMoment ? (
            <View
              style={
                sale?.mode === 'AUCTION'
                  ? { alignItems: 'center' }
                  : { marginBottom: tokens.spacing.md }
              }
            >
              <WinMoment data={live.winMoment} />
            </View>
          ) : null}
          {/* `position: 'relative'` + the rail's own `position: 'absolute'` below is deliberate:
              the rail used to sit as a flex sibling of the chat column, so any change to its own
              height (more gap between its 3 buttons, more bottom space) pushed LiveProductPanel's
              price down with it. Taking it out of flow pins it purely to this row's own bottom
              edge, independent of the price row underneath (founder feedback, 27 Oct 2026: more
              space above the rail, more space between its buttons, bid price must not move). */}
          <View style={{ position: 'relative' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <View style={{ flex: 1, paddingRight: 64 }}>
                <LiveChatOverlay comments={chat.messages} />
                {chatInputActive ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: tokens.spacing.sm,
                    marginBottom: tokens.spacing.md,
                  }}
                >
                  <TextInput
                    autoFocus
                    value={chatDraft}
                    onChangeText={setChatDraft}
                    onSubmitEditing={sendChat}
                    onBlur={() => {
                      if (!chatDraft.trim()) setChatInputActive(false);
                    }}
                    blurOnSubmit={false}
                    returnKeyType="send"
                    placeholder="Say something…"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    style={{
                      flex: 1,
                      height: 40,
                      borderRadius: 20,
                      paddingHorizontal: tokens.spacing.lg,
                      backgroundColor: 'transparent',
                      borderWidth: 0.5,
                      borderColor: 'rgba(255,255,255,0.7)',
                      color: '#FFFFFF',
                      fontSize: 14,
                    }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Send"
                    disabled={!chatDraft.trim()}
                    onPress={sendChat}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      opacity: chatDraft.trim() ? 1 : 0.4,
                    }}
                  >
                    <Feather name="send" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Say something"
                  onPress={() => setChatInputActive(true)}
                  style={{
                    height: 40,
                    borderRadius: 20,
                    justifyContent: 'center',
                    paddingHorizontal: tokens.spacing.lg,
                    backgroundColor: 'transparent',
                    borderWidth: 0.5,
                    borderColor: 'rgba(255,255,255,0.7)',
                    marginBottom: tokens.spacing.md,
                  }}
                >
                  <AppText white size={14} style={{ opacity: 0.8 }}>
                    Say something…
                  </AppText>
                </Pressable>
              )}
              </View>
            </View>
            <View style={{ position: 'absolute', right: 0, bottom: 18 }}>
              <LiveActionRail
                onShare={() => void shareStream({ title: session.title, url: APP_WEB_URL })}
                onShop={() => setSheet(product ? 'product' : '')}
                onWallet={() => setSheet('wallet')}
              />
            </View>
          </View>
          {live.spinNotice ? (
            <AppText white bold size={13} style={{ marginBottom: tokens.spacing.sm }}>
              {live.spinNotice}
            </AppText>
          ) : null}
          <LiveProductPanel
            product={product}
            sale={sale}
            everFeatured={live.everFeatured}
            streamTitle={session.title}
            leaderName={live.leaderName}
            leading={live.leading}
            notice={live.outbidNotice ?? live.featuredNotice ?? live.offerResponseNotice}
            now={now}
            onProduct={() => setSheet('product')}
            onBid={() => {
              setCustom(minimumDollars !== null ? String(minimumDollars) : '');
              setSheet('confirm');
            }}
            onCustom={() => {
              setCustom(minimumDollars !== null ? String(minimumDollars) : '');
              setSheet('custom');
            }}
            onBuyNow={() => live.buyNow()}
            onOffer={() => {
              setCustom('');
              setSheet('offer');
            }}
          />
          {live.loadError ? (
            <AppText white size={13} style={{ opacity: 0.7 }}>
              {live.loadError}
            </AppText>
          ) : null}
        </KeyboardAvoidingView>
      </Animated.View>

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
