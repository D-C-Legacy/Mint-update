import { Inject, Injectable } from '@nestjs/common';
import { SALE_REPOSITORY, SaleRepositoryPort } from '../../domain/ports/sale.repository.port';
import { Sale } from '../../domain/entities/sale.entity';
import { SaleMode } from '../../domain/entities/sale.entity';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { CatalogService } from '../../../catalog/application/catalog.service';
import { IdentityService } from '../../../identity/application/identity.service';
import { StorageService } from '../../../../platform/storage/storage.service';

export interface ListSessionPurchasesCommand {
  readonly sessionId: string;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

export interface SessionPurchase {
  readonly saleId: string;
  readonly productId: string;
  readonly productTitle: string | null;
  readonly productImageUrl: string | null;
  readonly mode: SaleMode;
  readonly currency: string;
  readonly finalAmount: bigint;
  readonly winnerUserId: string;
  readonly winnerDisplayName: string | null;
  readonly resolvedAt: Date;
}

@Injectable()
export class ListSessionPurchasesQuery {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly sales: SaleRepositoryPort,
    private readonly catalog: CatalogService,
    private readonly identity: IdentityService,
    private readonly storage: StorageService,
  ) {}

  async execute(cmd: ListSessionPurchasesCommand): Promise<CursorPage<SessionPurchase>> {
    const limit = normalizeLimit(cmd.limit);
    const page = buildCursorPage(
      await this.sales.listBySessionId({
        sessionId: cmd.sessionId,
        cursor: cmd.cursor,
        limit,
      }),
      limit,
    );

    const enriched = await Promise.all(page.items.map((sale) => this.enrich(sale)));

    const items = enriched.filter((item): item is SessionPurchase => item !== null);
    return { items, nextCursor: page.nextCursor };
  }

  private async enrich(sale: Sale): Promise<SessionPurchase | null> {
    const productResult = await this.catalog.getProduct({
      userId: sale.sellerId,
      productId: sale.productId,
    });
    let productTitle: string | null = null;
    let productImageUrl: string | null = null;
    if (productResult.ok) {
      productTitle = productResult.value.title;
      const imagesResult = await this.catalog.listProductImages({
        userId: sale.sellerId,
        productId: sale.productId,
      });
      if (imagesResult.ok && imagesResult.value.length > 0) {
        const first = imagesResult.value.slice().sort((a, b) => a.position - b.position)[0];
        if (first) productImageUrl = this.storage.getPublicUrl(first.storageKey);
      }
    }

    const winner = await this.identity.getUserById({ userId: sale.winnerUserId ?? '' });
    if (!sale.winnerUserId || !sale.finalAmount || !sale.resolvedAt) {
      return null;
    }

    return {
      saleId: sale.id,
      productId: sale.productId,
      productTitle,
      productImageUrl,
      mode: sale.mode,
      currency: sale.currency,
      finalAmount: sale.finalAmount,
      winnerUserId: sale.winnerUserId,
      winnerDisplayName: winner?.displayName ?? null,
      resolvedAt: sale.resolvedAt,
    };
  }
}
