import { Injectable, Inject } from '@nestjs/common';
import { CursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { PRODUCT_REPOSITORY, ProductRepositoryPort } from '../../domain/ports/product.repository.port';
import {
  PRODUCT_IMAGE_REPOSITORY,
  ProductImageRepositoryPort,
} from '../../domain/ports/product-image.repository.port';
import { Product } from '../../domain/entities/product.entity';
import { ProductImage } from '../../domain/entities/product-image.entity';

export interface PublicProductItem {
  readonly product: Product;
  readonly images: ProductImage[];
}

export interface ListPublicProductsCommand {
  readonly categoryId: string | undefined;
  readonly sellerId: string | undefined;
  readonly q: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// Public catalog browse (05-API-SPEC.md §4). Read-only, no owner check.
@Injectable()
export class ListPublicProductsQuery {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
    @Inject(PRODUCT_IMAGE_REPOSITORY) private readonly images: ProductImageRepositoryPort,
  ) {}

  async execute(cmd: ListPublicProductsCommand): Promise<CursorPage<PublicProductItem>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.products.listPublic({
      categoryId: cmd.categoryId,
      sellerId: cmd.sellerId,
      q: cmd.q,
      cursor: cmd.cursor,
      limit,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const images = await this.images.findByProductIds(page.map((p) => p.id));

    const items = page.map((product) => ({
      product,
      images: images.filter((image) => image.productId === product.id),
    }));
    return { items, nextCursor: hasMore && last ? last.id : null };
  }
}
