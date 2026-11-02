import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from '../../application/catalog.service';
import { StorageService } from '../../../../platform/storage/storage.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { ListPublicProductsQuerySchema, ListPublicProductsQueryDto } from './dto/list-public-products-query.dto';
import { toPublicProductView } from './public-product.view';

// Public, unguarded browse routes, same as GET /categories. The seller's own product routes stay
// at /products, so nothing existing changes.
@Controller('catalog')
export class PublicCatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly storage: StorageService,
  ) {}

  @Get('products')
  async listProducts(
    @Query(new ZodValidationPipe(ListPublicProductsQuerySchema)) query: ListPublicProductsQueryDto,
  ): Promise<{ data: unknown }> {
    const page = await this.catalog.listPublicProducts({
      categoryId: query.categoryId,
      sellerId: query.sellerId,
      q: query.q,
      cursor: query.cursor,
      limit: query.limit,
    });
    const imageUrlFor = (key: string): string => this.storage.getPublicUrl(key);
    return {
      data: {
        items: page.items.map((item) => toPublicProductView(item, imageUrlFor)),
        nextCursor: page.nextCursor,
      },
    };
  }

  @Get('products/:id')
  async getProduct(@Param('id') productId: string): Promise<{ data: unknown }> {
    const result = await this.catalog.getPublicProduct({ productId });
    if (!result.ok) throw toHttpException(result.error);
    const imageUrlFor = (key: string): string => this.storage.getPublicUrl(key);
    return { data: toPublicProductView(result.value, imageUrlFor) };
  }
}
