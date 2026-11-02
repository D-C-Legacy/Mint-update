import * as tokens from '../../theme';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, Badge, Button, Field, Icon, Photo, s } from '../../components';
import { colors as c } from '../../theme';
import { useApp } from '../../hooks';
import { respondToOffer, type RespondToOfferResult, type SellerOffer } from '../../api/sales';
import { dollars } from '../../api/orders';
import { describeApiError } from '../../api/describe-error';

// Shared seller-offer renderers, used by both the mobile list and the desktop master-detail
// (list left, selected offer right) — same split as the SellerOrders family.

// Honest status labels: the offer's own status, never a rewording that hides what the server
// actually returned. Colors mirror the app's badge language (live = red, success = green).
export const OFFER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  COUNTERED: 'Countered',
  EXPIRED: 'Expired',
  WITHDRAWN: 'Withdrawn',
};

function offerBadgeColor(status: string): string {
  switch (status) {
    case 'ACCEPTED':
      return c.success;
    case 'REJECTED':
    case 'EXPIRED':
      return c.live;
    case 'WITHDRAWN':
      return c.textSecondary;
    default:
      return c.brand;
  }
}

// Product photos degrade honestly: no image key (product fields can null on the server) shows
// the same image-outline placeholder box the shared Photo component uses for failed loads.
function OfferThumb({ uri, size }: { uri: string | null; size: number }) {
  if (uri) {
    return <Photo uri={uri} style={{ width: size, height: size, borderRadius: tokens.radii.md }} />;
  }
  return (
    <View
      accessibilityLabel="Product photo placeholder"
      style={{
        width: size,
        height: size,
        borderRadius: tokens.radii.md,
        backgroundColor: tokens.colors.imagePlaceholder,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="image-outline" size={size * 0.45} color={c.textSecondary} />
    </View>
  );
}

// A light list row for the desktop master-detail: amount, item, buyer, status. No actions —
// those live on the full card on the right.
export function SellerOfferRow({
  offer,
  selected,
  onPress,
}: {
  offer: SellerOffer;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Offer ${offer.id}`}
      onPress={onPress}
      style={[
        s.row,
        {
          gap: tokens.spacing.md,
          paddingVertical: tokens.spacing.lg,
          borderBottomWidth: 1,
          borderColor: c.line,
          backgroundColor: selected ? c.softCanvas : 'transparent',
        },
      ]}
    >
      <OfferThumb uri={offer.product.imageUrl} size={44} />
      <View style={{ flex: 1 }}>
        <AppText bold>{dollars(offer.amount)}</AppText>
        <AppText muted size={12} numberOfLines={1}>
          {offer.product.title ?? 'Item'} · {offer.buyerDisplayName ?? 'Buyer'} ·{' '}
          {new Date(offer.createdAt).toLocaleDateString()}
        </AppText>
      </View>
      <Badge
        label={OFFER_STATUS_LABEL[offer.status] ?? offer.status}
        color={offerBadgeColor(offer.status)}
      />
    </Pressable>
  );
}

// Signs the seller's accepted/rejected/countered decision up to the parent screen, which owns
// the list (remove from Pending, update in place in History). The card holds only local state.
export type OfferResponded = (result: RespondToOfferResult) => void;

// The full offer card: product, buyer, amounts, and — on PENDING offers whose sale is still
// OPEN — the real Accept / Reject / Counter actions wired to POST /offers/:id/respond.
export function SellerOfferCard({
  offer,
  onResponded,
}: {
  offer: SellerOffer;
  onResponded: OfferResponded;
}) {
  const app = useApp();
  const [countering, setCountering] = useState(false);
  const [counter, setCounter] = useState('');
  const [working, setWorking] = useState(false);

  const respond = async (action: 'ACCEPT' | 'REJECT' | 'COUNTER', counterMinor?: number) => {
    setWorking(true);
    try {
      const result = await respondToOffer(offer.id, action, counterMinor);
      onResponded(result);
      app.toast(
        action === 'ACCEPT'
          ? 'Offer accepted. The order is ready.'
          : action === 'REJECT'
            ? 'Offer rejected.'
            : 'Counter offer sent.',
      );
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setWorking(false);
    }
  };

  const runCounter = () => {
    const parsed = Number.parseFloat(counter);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      app.toast('Enter a counter price.');
      return;
    }
    respond('COUNTER', Math.round(parsed * 100));
  };

  const actionable = offer.status === 'PENDING' && offer.saleStatus === 'OPEN';

  return (
    <View style={[s.card, { marginBottom: tokens.spacing.md, gap: 10 }]}>
      <View style={[s.row, { gap: tokens.spacing.md }]}>
        <OfferThumb uri={offer.product.imageUrl} size={56} />
        <View style={{ flex: 1 }}>
          <AppText bold numberOfLines={2}>
            {offer.product.title ?? 'Item'}
          </AppText>
          <AppText muted size={12}>
            {offer.product.condition ? `${offer.product.condition} · ` : ''}
            From {offer.buyerDisplayName ?? 'a buyer'}
          </AppText>
        </View>
        <Badge
          label={OFFER_STATUS_LABEL[offer.status] ?? offer.status}
          color={offerBadgeColor(offer.status)}
        />
      </View>
      <View style={s.row}>
        <AppText size={22} bold>
          {dollars(offer.amount)}
        </AppText>
        <AppText muted size={12}>
          {offer.currency}
        </AppText>
      </View>
      <AppText muted size={12}>
        Received {new Date(offer.createdAt).toLocaleDateString()}
        {offer.status === 'PENDING'
          ? ` · Expires ${new Date(offer.expiresAt).toLocaleDateString()}`
          : ''}
      </AppText>
      {offer.status === 'COUNTERED' && offer.counterAmount !== null ? (
        <AppText muted size={12}>
          You countered at {dollars(offer.counterAmount)}.
        </AppText>
      ) : null}
      {actionable ? (
        countering ? (
          <View style={{ gap: tokens.spacing.sm, marginTop: tokens.spacing.xs }}>
            <Field
              label="Your counter price (USD)"
              value={counter}
              onChange={setCounter}
              placeholder="0.00"
              keyboardType="numeric"
            />
            <Button label="Send counter offer" loading={working} onPress={runCounter} />
            <Button
              secondary
              label="Back"
              disabled={working}
              onPress={() => {
                setCountering(false);
                setCounter('');
              }}
            />
          </View>
        ) : (
          <View style={[s.row, { gap: tokens.spacing.sm, marginTop: tokens.spacing.xs }]}>
            <View style={{ flex: 1 }}>
              <Button label="Accept" loading={working} onPress={() => respond('ACCEPT')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button secondary label="Counter" onPress={() => setCountering(true)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button variant="danger" label="Reject" onPress={() => respond('REJECT')} />
            </View>
          </View>
        )
      ) : null}
    </View>
  );
}
