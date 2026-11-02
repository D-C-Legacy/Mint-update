import { api } from './index';
import type { Page, SaleMode } from './catalog';

// Full sale state from GET /v1/sales/:id. Unlike the public list, this includes the winner and
// current bid id, which the buyer's own bid history needs.
export type SaleDetail = {
  id: string;
  sessionId: string;
  sellerId: string;
  productId: string;
  mode: SaleMode;
  status: 'OPEN' | 'CLOSING' | 'RESOLVED' | 'CANCELLED' | 'EXPIRED';
  currency: string;
  startAmount: number | null;
  currentAmount: number | null;
  currentBidId: string | null;
  endsAt: string | null;
  price: number | null;
  quantity: number;
  winnerUserId: string | null;
  finalAmount: number | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type MyBid = {
  id: string;
  saleId: string;
  amount: number;
  sequence: number;
  status: string;
  createdAt: string;
};

export type PlaceBidResult = {
  bidId: string;
  amount: number;
  endsAt: string;
  extended: boolean;
  serverNow: string;
};

// Every money POST needs a client reference. Unique per attempt, under the 64-character limit.
export function newClientRef(): string {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Dollars to minor units (USD cents). The API takes integers only.
export function toMinor(dollars: number): number {
  return Math.round(dollars * 100);
}

export function getSale(saleId: string): Promise<SaleDetail> {
  return api.request<SaleDetail>(`/sales/${encodeURIComponent(saleId)}`);
}

export function placeBid(saleId: string, dollars: number): Promise<PlaceBidResult> {
  return api.request<PlaceBidResult>(`/sales/${encodeURIComponent(saleId)}/bids`, {
    method: 'POST',
    body: { amount: toMinor(dollars), clientRef: newClientRef() },
  });
}

export function buyNow(
  saleId: string,
): Promise<{ saleId: string; finalAmount: number; quantity: number }> {
  return api.request(`/sales/${encodeURIComponent(saleId)}/buy`, {
    method: 'POST',
    body: { clientRef: newClientRef() },
  });
}

export function submitOffer(
  saleId: string,
  dollars: number,
): Promise<{ offerId: string; amount: number; expiresAt: string }> {
  return api.request(`/sales/${encodeURIComponent(saleId)}/offers`, {
    method: 'POST',
    body: { amount: toMinor(dollars), clientRef: newClientRef() },
  });
}

// Not in 05-API-SPEC.md — new with the live-streaming work (founder_requests.md §1, decided 14 Oct
// 2026: switching keeps the same sale and its bids, not a cancel-and-recreate). Seller only.
export type SwitchSaleModeInput =
  | { mode: 'AUCTION'; startAmount: number; durationSeconds?: number }
  | { mode: 'BUY_NOW'; price: number; quantity: number }
  | { mode: 'OFFER' };

export function switchSaleMode(
  saleId: string,
  input: SwitchSaleModeInput,
): Promise<{ saleId: string; mode: SaleMode }> {
  return api.request<{ saleId: string; mode: SaleMode }>(
    `/sales/${encodeURIComponent(saleId)}/mode`,
    {
      method: 'POST',
      body: input,
    },
  );
}

// The signed-in buyer's own bids, most recent first (GET /v1/me/bids).
export function listMyBids(cursor?: string): Promise<Page<MyBid>> {
  return api.request<Page<MyBid>>('/me/bids', { query: { limit: 20, cursor } });
}

// Shape of GET /v1/seller/offers — the seller's offer inbox (Phase 2 of the offers arc, not in
// 05-API-SPEC.md; backend contract is public-sale.view.ts's SellerOfferView). Money is minor-unit
// numbers, dates are ISO strings, the buyer appears only as a display name (never a raw id).
export type SellerOfferProduct = {
  id: string;
  title: string | null;
  condition: string | null;
  imageUrl: string | null;
};

export type SellerOffer = {
  id: string;
  saleId: string;
  amount: number;
  counterAmount: number | null;
  status: string;
  respondedAt: string | null;
  expiresAt: string;
  createdAt: string;
  currency: string;
  saleMode: string;
  saleStatus: string;
  product: SellerOfferProduct;
  buyerDisplayName: string | null;
};

// The seller's offers across every sale, cursor-paginated (GET /seller/offers). Omitting
// `statuses` uses the route's own default (PENDING only — the actionable inbox, user decision
// 17 Oct 2026); response history needs an explicit list, e.g. ["ACCEPTED", "COUNTERED"].
export function listSellerOffers(
  options: { statuses?: string[]; cursor?: string; limit?: number } = {},
): Promise<Page<SellerOffer>> {
  return api.request<Page<SellerOffer>>('/seller/offers', {
    query: {
      status: options.statuses?.length ? options.statuses.join(',') : undefined,
      cursor: options.cursor,
      limit: options.limit,
    },
  });
}

// Seller's response to an offer (POST /offers/:id/respond, 05-API-SPEC.md §7): ACCEPT resolves
// the sale and creates a real order like a buy-now; COUNTER carries the counter price in minor
// units (run it through toMinor first). Money fields come back as minor-unit numbers.
export type RespondToOfferResult = {
  offerId: string;
  status: string;
  counterAmount: number | null;
};

export function respondToOffer(
  offerId: string,
  action: 'ACCEPT' | 'REJECT' | 'COUNTER',
  counterAmount?: number,
): Promise<RespondToOfferResult> {
  return api.request<RespondToOfferResult>(`/offers/${encodeURIComponent(offerId)}/respond`, {
    method: 'POST',
    body: action === 'COUNTER' ? { action, counterAmount } : { action },
  });
}
