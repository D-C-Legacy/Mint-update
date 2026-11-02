import React from 'react';
import { View, Pressable } from 'react-native';
import { AppText } from '../ui';
import { CONDITION_LABELS, type PublicProduct } from '../../api/catalog';
import type { SaleDetail } from '../../api/sales';
import { colors, spacing, radii, formatUSD } from '../../theme';
import { LeaderLine, QuietNotice } from './BidFeedback';

const shadow = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowRadius: 4,
  textShadowOffset: { width: 0, height: 1 },
};

function remaining(endsAt: string | null, now: number): string {
  if (!endsAt) return '';
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

// Bottom block, styled as plain text over the video: the title on the left with the price above a
// timer on the right, the single leader-indicator line, an outbid/featured notice when there is
// one, then the bid controls. Real sale state, not the old mock auction reducer.
//
// No placeholder button when nothing is currently featured — founder feedback (23 Oct 2026): never
// a dimmed, non-functional bid button sitting there with nothing behind it. A headline + muted
// subtext still show (further founder feedback, 26 Oct 2026: one bare line of text read as
// unfinished, not intentional). `everFeatured` (from `useLiveReel`) picks the headline: "Auction
// hasn't started" the first time, "Awaiting next item" once at least one item has already been
// through.
export function LiveProductPanel({
  product,
  sale,
  everFeatured,
  streamTitle,
  leaderName,
  leading,
  notice,
  now,
  onProduct,
  onBid,
  onCustom,
  onBuyNow,
  onOffer,
}: {
  product: PublicProduct | null;
  sale: SaleDetail | null;
  everFeatured: boolean;
  streamTitle: string;
  leaderName: string | null;
  leading: boolean;
  notice: string | null;
  now: number;
  onProduct: () => void;
  onBid: () => void;
  onCustom: () => void;
  onBuyNow: () => void;
  onOffer: () => void;
}) {
  if (!product || !sale) {
    return (
      <View style={{ gap: 2 }}>
        <AppText white bold size={14} style={shadow}>
          {everFeatured ? 'Awaiting next item' : "Auction hasn't started"}
        </AppText>
        <AppText white size={12} style={[shadow, { opacity: 0.75 }]}>
          Stick around, bidding starts soon.
        </AppText>
      </View>
    );
  }

  const open = sale.status === 'OPEN';
  const current = sale.mode === 'AUCTION' ? (sale.currentAmount ?? sale.startAmount) : sale.price;
  const currentDollars = current === null ? null : current / 100;
  const timer = sale.mode === 'AUCTION' ? remaining(sale.endsAt, now) : '';
  const ended =
    sale.mode === 'AUCTION' && sale.endsAt !== null && new Date(sale.endsAt).getTime() <= now;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open live product details"
          onPress={onProduct}
          style={{ flex: 1, gap: 2 }}
        >
          {/* numberOfLines locks title+condition+shipping to one line — the combined text was
              long enough to wrap on a narrow phone otherwise (founder-reported, 27 Oct 2026). */}
          <AppText white bold size={16} style={shadow} numberOfLines={1}>
            {product.title.toUpperCase()}
            <AppText white size={13} style={shadow}>
              {' '}
              · {CONDITION_LABELS[product.condition]}
              {/* Flat $0 shipping fee, generic tax label, no real number — decided 27 Oct 2026:
                  checkout itself still hardcodes shippingAmount/taxAmount to 0 until a real
                  shipping/tax system exists, so this is the only line that stays true to what a
                  buyer is actually charged. Revisit together once real shipping/tax ships. */}
              {' '}
              · Free ship + tax
            </AppText>
          </AppText>
          {streamTitle ? (
            <AppText white size={12} style={[shadow, { opacity: 0.75 }]}>
              {streamTitle}
            </AppText>
          ) : null}
        </Pressable>
        {currentDollars !== null && (
          <View style={{ alignItems: 'flex-end' }}>
            <AppText white bold size={20} style={[shadow, { fontVariant: ['tabular-nums'] }]}>
              {formatUSD(currentDollars)}
            </AppText>
            {!!timer && (
              <AppText
                bold
                size={14}
                style={[
                  shadow,
                  { color: ended ? colors.urgent : colors.canvas, fontVariant: ['tabular-nums'] },
                ]}
              >
                {ended ? 'ENDING' : timer}
              </AppText>
            )}
          </View>
        )}
      </View>

      {notice ? (
        <QuietNotice text={notice} />
      ) : open && sale.mode === 'AUCTION' ? (
        <LeaderLine leaderName={leaderName} leading={leading} />
      ) : null}

      {!open ? (
        // Founder feedback (round5, msg 4): once an item has been featured, the primary action
        // stays a single constant button shape across its whole lifecycle instead of disappearing
        // into plain text once it closes — only its label changes. This does NOT apply to the
        // no-item-featured empty state above, which stays bare headline text per round4's explicit
        // "never a dimmed, non-functional button with nothing behind it" decision.
        <View
          style={{
            height: 44,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.25)',
          }}
        >
          <AppText white bold size={15}>
            {sale.status === 'RESOLVED' ? 'Sold' : 'Ended'}
          </AppText>
        </View>
      ) : sale.mode === 'BUY_NOW' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            currentDollars !== null ? `Buy now ${formatUSD(currentDollars)}` : 'Buy now'
          }
          onPress={onBuyNow}
          style={({ pressed }) => ({
            height: 44,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brand,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <AppText white bold size={15}>
            {currentDollars !== null ? `Buy now · ${formatUSD(currentDollars)}` : 'Buy now'}
          </AppText>
        </Pressable>
      ) : sale.mode === 'OFFER' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Make an offer"
          onPress={onOffer}
          style={({ pressed }) => ({
            height: 44,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brand,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <AppText white bold size={15}>
            Make an offer
          </AppText>
        </Pressable>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Custom bid"
            onPress={onCustom}
            style={({ pressed }) => ({
              height: 44,
              paddingHorizontal: 18,
              borderRadius: radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.75)',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <AppText white bold size={14}>
              Custom Bid
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Place bid"
            disabled={ended}
            onPress={onBid}
            style={({ pressed }) => ({
              flex: 1,
              height: 44,
              borderRadius: radii.pill,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: ended ? 'rgba(255,255,255,0.25)' : colors.brand,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <AppText white bold size={15}>
              {ended ? 'ENDED' : 'Place a bid'}
            </AppText>
          </Pressable>
        </View>
      )}
    </View>
  );
}
