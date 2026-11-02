import { Inject, Injectable } from '@nestjs/common';
import { OFFER_REPOSITORY, OfferRepositoryPort } from '../../domain/ports/offer.repository.port';
import { SALE_REPOSITORY, SaleRepositoryPort } from '../../domain/ports/sale.repository.port';
import { Offer, OfferStatus } from '../../domain/entities/offer.entity';
import { SaleMode, SaleStatus } from '../../domain/entities/sale.entity';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { SellersService } from '../../../sellers/application/sellers.service';
import { CatalogService } from '../../../catalog/application/catalog.service';
import { IdentityService } from '../../../identity/application/identity.service';
import { StorageService } from '../../../../platform/storage/storage.service';

export interface ListSellerOffersCommand {
  readonly sellerUserId: string;
  readonly statuses: OfferStatus[] | undefined;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// Application-layer read model for the seller's offer inbox — the raw Offer plus what the
// screen needs in one round trip: the sale's currency/mode/status (an offer carries no currency
// itself; status gates the respond actions), the owning product, and the buyer's display name
// (the same IdentityService lookup SalesGateway's resolveDisplayName uses — a buyer's raw user id
// is never returned to the seller).
export interface SellerOffer {
  readonly offer: Offer;
  readonly saleCurrency: string;
  readonly saleMode: SaleMode;
  readonly saleStatus: SaleStatus;
  readonly product: {
    readonly id: string;
    readonly title: string | null;
    readonly condition: string | null;
    readonly imageUrl: string | null;
  };
  readonly buyerDisplayName: string | null;
}

// Offers on this seller's own sales, across every sale (GET /seller/offers, the 2b route).
// Mirrors ListSellerOrdersQuery: the caller's seller profile is resolved here, and a caller with
// no seller profile gets an empty page, not an error — same as a buyer with no orders.
@Injectable()
export class ListSellerOffersQuery {
  constructor(
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepositoryPort,
    @Inject(SALE_REPOSITORY) private readonly sales: SaleRepositoryPort,
    private readonly sellers: SellersService,
    private readonly catalog: CatalogService,
    private readonly storage: StorageService,
    private readonly identity: IdentityService,
  ) {}

  async execute(cmd: ListSellerOffersCommand): Promise<CursorPage<SellerOffer>> {
    const limit = normalizeLimit(cmd.limit);
    const seller = await this.sellers.getMySeller({ userId: cmd.sellerUserId });
    if (!seller.ok) {
      return buildCursorPage([], limit);
    }
    const page = buildCursorPage(
      await this.offers.listBySellerId({
        sellerId: seller.value.seller.id,
        // exactOptionalPropertyTypes: the port's `statuses?` must not receive an explicit
        // undefined — omit the key entirely when the caller didn't filter.
        ...(cmd.statuses ? { statuses: cmd.statuses } : {}),
        cursor: cmd.cursor,
        limit,
      }),
      limit,
    );
    const enriched = await Promise.all(
      page.items.map((offer) => this.enrich(offer, cmd.sellerUserId)),
    );
    // Filtering a dropped row here can desync the page from nextCursor, but the only drop case
    // is a sale missing under a live FK relation — corrupted state, not a normal path.
    const items = enriched.filter((item): item is SellerOffer => item !== null);
    return { items, nextCursor: page.nextCursor };
  }

  // Per-offer lookups (sale, product, images, buyer) — a page is at most 20, and this is the
  // seller's own inbox screen, not a hot public path. Degrades honestly rather than failing the
  // whole page: unresolvable product fields go null, an unknown buyer shows as null name.
  private async enrich(offer: Offer, sellerUserId: string): Promise<SellerOffer | null> {
    const sale = await this.sales.findById(offer.saleId);
    if (!sale) {
      return null;
    }
    let product: SellerOffer['product'] = {
      id: sale.productId,
      title: null,
      condition: null,
      imageUrl: null,
    };
    const productResult = await this.catalog.getProduct({
      userId: sellerUserId,
      productId: sale.productId,
    });
    if (productResult.ok) {
      // Built once as a fresh object rather than mutated field-by-field: `SellerOffer['product']`
      // is readonly, so assigning through it doesn't typecheck.
      let imageUrl: string | null = null;
      const imagesResult = await this.catalog.listProductImages({
        userId: sellerUserId,
        productId: sale.productId,
      });
      if (imagesResult.ok && imagesResult.value.length > 0) {
        const first = imagesResult.value.slice().sort((a, b) => a.position - b.position)[0];
        if (first) imageUrl = this.storage.getPublicUrl(first.storageKey);
      }
      product = {
        id: sale.productId,
        title: productResult.value.title,
        condition: productResult.value.condition,
        imageUrl,
      };
    }
    const buyer = await this.identity.getUserById({ userId: offer.userId });
    return {
      offer,
      saleCurrency: sale.currency,
      saleMode: sale.mode,
      saleStatus: sale.status,
      product,
      buyerDisplayName: buyer?.displayName ?? null,
    };
  }
}
