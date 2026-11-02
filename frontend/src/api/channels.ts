import { api } from './index';

// The public channel view (05-API-SPEC.md §5). Hides the raw banner key; `bannerUrl` is the CDN URL.
export type ChannelSummary = {
  id: string;
  sellerId: string;
  slug: string;
  name: string;
  bio: string | null;
  bannerUrl: string | null;
  followerCount: number;
  isActive: boolean;
  createdAt: string;
};

export type ChannelPage = { items: ChannelSummary[]; nextCursor: string | null };

// Active channels, most followed first. `sellerId` returns the one channel a seller owns.
export function listChannels(
  filter: { sellerId?: string; cursor?: string; limit?: number } = {},
): Promise<ChannelPage> {
  return api.request<ChannelPage>('/channels', { query: { ...filter }, auth: false });
}

// One page of the signed-in user's followed channels, from GET /v1/me/following.
export function listFollowedChannels(cursor?: string): Promise<ChannelPage> {
  return api.request<ChannelPage>('/me/following', { query: { limit: 20, cursor } });
}

// Whether the signed-in user follows this channel. The API has no per-channel check, so this
// walks the following list one page at a time.
export async function isFollowing(channelId: string): Promise<boolean> {
  let cursor: string | undefined;
  do {
    const page = await listFollowedChannels(cursor);
    if (page.items.some((channel) => channel.id === channelId)) return true;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return false;
}

export function getChannelBySlug(slug: string): Promise<ChannelSummary> {
  return api.request<ChannelSummary>(`/channels/${encodeURIComponent(slug)}`);
}

// No GET /channels/:id route exists (only by slug). A stream session only carries a channelId, so
// this walks the public list one page at a time, same pattern as `isFollowing` above.
export async function getChannelById(channelId: string): Promise<ChannelSummary | null> {
  let cursor: string | undefined;
  do {
    const page = await listChannels({ cursor });
    const found = page.items.find((channel) => channel.id === channelId);
    if (found) return found;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return null;
}

export function followChannel(channelId: string): Promise<unknown> {
  return api.request(`/channels/${encodeURIComponent(channelId)}/follow`, { method: 'POST' });
}

export function unfollowChannel(channelId: string): Promise<unknown> {
  return api.request(`/channels/${encodeURIComponent(channelId)}/follow`, { method: 'DELETE' });
}
