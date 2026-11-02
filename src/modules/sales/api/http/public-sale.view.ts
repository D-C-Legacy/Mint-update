import { Sale } from '../../domain/entities/sale.entity';
import { Bid } from '../../domain/entities/bid.entity';
import type { SellerOffer } from '../../application/queries/list-seller-offers.query';

// Public shape for GET /v1/sales. Hidden: `winnerUserId` (who won), `orderId`, `version`
// (internal concurrency counter). Money is integer minor units, a plain number (05-API-SPEC §1).
export interface PublicSaleView {
  readonly id: string;
  readonly sessionId: string;
  readonly sellerId: string;
  readonly productId: string;
  readonly mode: string;
  readonly status: string;
  readonly currency: string;
  readonly startAmount: number | null;
  readonly currentAmount: number | null;
  readonly price: number | null;
  readonly quantity: number;
  readonly endsAt: string | null;
  readonly extensionCount: number;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
}

export function toPublicSaleView(sale: Sale): PublicSaleView {
  return {
    id: sale.id,
    sessionId: sale.sessionId,
    sellerId: sale.sellerId,
    productId: sale.productId,
    mode: sale.mode,
    status: sale.status,
    currency: sale.currency,
    startAmount: sale.startAmount === null ? null : Number(sale.startAmount),
    currentAmount: sale.currentAmount === null ? null : Number(sale.currentAmount),
    price: sale.price === null ? null : Number(sale.price),
    quantity: sale.quantity,
    endsAt: sale.endsAt ? sale.endsAt.toISOString() : null,
    extensionCount: sale.extensionCount,
    resolvedAt: sale.resolvedAt ? sale.resolvedAt.toISOString() : null,
    createdAt: sale.createdAt.toISOString(),
  };
}

// GET /v1/sales/:id — "Sale state snapshot," auth optional (05-API-SPEC.md §7). Unlike the public
// list, the product page genuinely needs `currentBidId` (does MY bid currently lead?) and
// `finalAmount` (the settled price, already shown to every viewer, winner or not — "Sold for $X").
// Neither identifies a person on its own. `winnerUserId` does, so it's the one field actually
// redacted here (Phase 9 hardening, flagged since Phase 5): anyone who isn't the winner gets
// `null` back, same as before any sale resolved — `iWon = winnerUserId === myId` on the client
// still works unchanged, it just never learns a stranger's id. `orderId`/`version` stay internal,
// same as the list view; neither is read anywhere in the app.
export interface SaleDetailView extends PublicSaleView {
  readonly currentBidId: string | null;
  readonly finalAmount: number | null;
  readonly winnerUserId: string | null;
}

export function toSaleDetailView(sale: Sale, viewerUserId: string | null): SaleDetailView {
  return {
    ...toPublicSaleView(sale),
    currentBidId: sale.currentBidId,
    finalAmount: sale.finalAmount === null ? null : Number(sale.finalAmount),
    winnerUserId:
      viewerUserId !== null && sale.winnerUserId === viewerUserId ? sale.winnerUserId : null,
  };
}

// Shape for GET /v1/me/bids. The buyer sees their own bids only, so no other bidder data appears.
export interface MyBidView {
  readonly id: string;
  readonly saleId: string;
  readonly amount: number;
  readonly sequence: number;
  readonly status: string;
  readonly createdAt: string;
}

export function toMyBidView(bid: Bid): MyBidView {
  return {
    id: bid.id,
    saleId: bid.saleId,
    amount: Number(bid.amount),
    sequence: bid.sequence,
    status: bid.status,
    createdAt: bid.createdAt.toISOString(),
  };
}

// Shape for GET /v1/seller/offers — the seller's offer inbox (Phase 2 of the offers arc, not in
// 05-API-SPEC.md). Money stays minor-units numbers, same as every other view here. The buyer
// appears only as a display name (a raw user id is never returned to the seller); product fields
// degrade to nulls when the product can no longer be resolved, and `saleStatus` gates the
// respond actions client-side (an offer on a no-longer-OPEN sale can't actually be responded to).
export interface SellerOfferProductView {
  readonly id: string;
  readonly title: string | null;
  readonly condition: string | null;
  readonly imageUrl: string | null;
}

export interface SellerOfferView {
  readonly id: string;
  readonly saleId: string;
  readonly amount: number;
  readonly counterAmount: number | null;
  readonly status: string;
  readonly respondedAt: string | null;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly currency: string;
  readonly saleMode: string;
  readonly saleStatus: string;
  readonly product: SellerOfferProductView;
  readonly buyerDisplayName: string | null;
}

export function toSellerOfferView(model: SellerOffer): SellerOfferView {
  return {
    id: model.offer.id,
    saleId: model.offer.saleId,
    amount: Number(model.offer.amount),
    counterAmount: model.offer.counterAmount === null ? null : Number(model.offer.counterAmount),
    status: model.offer.status,
    respondedAt: model.offer.respondedAt ? model.offer.respondedAt.toISOString() : null,
    expiresAt: model.offer.expiresAt.toISOString(),
    createdAt: model.offer.createdAt.toISOString(),
    currency: model.saleCurrency,
    saleMode: model.saleMode,
    saleStatus: model.saleStatus,
    product: model.product,
    buyerDisplayName: model.buyerDisplayName,
  };
}
