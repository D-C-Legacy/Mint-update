import { useEffect, useState } from 'react';
import { listProducts, toCards, type CardProduct } from '../api/catalog';
import {
  followChannel,
  getChannelBySlug,
  isFollowing,
  unfollowChannel,
  type ChannelSummary,
} from '../api/channels';
import { listSellerReviews, type ReviewView } from '../api/reviews';
import { describeApiError } from '../api/describe-error';
import { useAsync } from '../api/use-async';
import { useApp } from '../context';

export type SellerData = {
  channel: ChannelSummary;
  cards: CardProduct[];
  following: boolean;
  reviews: ReviewView[];
  ratingSummary: { averageRating: number; reviewCount: number };
};

// A seller's public page, keyed by channel slug: the channel, its products, and whether the
// signed-in user follows it.
export async function loadSeller(slug: string): Promise<SellerData> {
  const channel = await getChannelBySlug(slug);
  const [products, following, reviewPage] = await Promise.all([
    listProducts({ sellerId: channel.sellerId, limit: 40 }),
    isFollowing(channel.id),
    listSellerReviews(channel.sellerId),
  ]);
  return {
    channel,
    cards: await toCards(products.items),
    following,
    reviews: reviewPage.items,
    ratingSummary: reviewPage.summary,
  };
}

// Shared SellerProfile data + follow state, used by both the mobile layout and the desktop 2-column
// layout so the two can't drift.
export function useSellerProfile(slug: string) {
  const app = useApp();
  const detail = useAsync(() => loadSeller(slug), [slug]);
  const [tab, setTab] = useState('Shop');
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (detail.state.status === 'ready') setFollowing(detail.state.data.following);
  }, [detail.state]);

  const toggleFollow = async () => {
    if (detail.state.status !== 'ready') return;
    setBusy(true);
    try {
      if (following) {
        await unfollowChannel(detail.state.data.channel.id);
        setFollowing(false);
      } else {
        await followChannel(detail.state.data.channel.id);
        setFollowing(true);
      }
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return { detail, tab, setTab, following, toggleFollow, busy };
}
