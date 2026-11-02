import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { PRODUCT_REPOSITORY, ProductRepositoryPort } from '../../domain/ports/product.repository.port';
import {
  PRODUCT_IMAGE_REPOSITORY,
  ProductImageRepositoryPort,
} from '../../domain/ports/product-image.repository.port';
import { ProductNotFoundError } from '../../domain/errors/catalog.errors';
import { PublicProductItem } from './list-public-products.query';

// A product is publicly visible only while ACTIVE. DRAFT, SOLD and ARCHIVED read as not found.
@Injectable()
export class GetPublicProductQuery {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
    @Inject(PRODUCT_IMAGE_REPOSITORY) private readonly images: ProductImageRepositoryPort,
  ) {}

  async execute(cmd: { productId: string }): Promise<Result<PublicProductItem, ProductNotFoundError>> {
    const product = await this.products.findById(cmd.productId);
    if (!product || product.status !== 'ACTIVE') {
      return Err(new ProductNotFoundError(cmd.productId));
    }
    const images = await this.images.findByProductIds([product.id]);
    return Ok({ product, images });
  }
}
