import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { CursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { SellersService } from '../../../sellers/application/sellers.service';
import { PRODUCT_REPOSITORY, ProductRepositoryPort } from '../../domain/ports/product.repository.port';
import { SellerProfileNotFoundError } from '../../domain/errors/catalog.errors';
import { Product, ProductStatus } from '../../domain/entities/product.entity';

export interface ListProductsCommand {
  readonly userId: string;
  readonly status: ProductStatus | undefined;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

@Injectable()
export class ListProductsQuery {
  constructor(
    private readonly sellers: SellersService,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
  ) {}

  async execute(
    cmd: ListProductsCommand,
  ): Promise<Result<CursorPage<Product>, SellerProfileNotFoundError>> {
    const sellerResult = await this.sellers.getMySeller({ userId: cmd.userId });
    if (!sellerResult.ok) {
      return Err(new SellerProfileNotFoundError(cmd.userId));
    }

    const limit = normalizeLimit(cmd.limit);
    const rows = await this.products.list({
      sellerId: sellerResult.value.seller.id,
      status: cmd.status,
      cursor: cmd.cursor,
      limit,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];

    return Ok({ items, nextCursor: hasMore && last ? last.id : null });
  }
}
