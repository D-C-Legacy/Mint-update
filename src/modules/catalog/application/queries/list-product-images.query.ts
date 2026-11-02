import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SellersService } from '../../../sellers/application/sellers.service';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '../../domain/ports/product.repository.port';
import {
  PRODUCT_IMAGE_REPOSITORY,
  ProductImageRepositoryPort,
} from '../../domain/ports/product-image.repository.port';
import {
  ProductNotFoundError,
  SellerProfileNotFoundError,
} from '../../domain/errors/catalog.errors';
import { ProductImage } from '../../domain/entities/product-image.entity';

export interface ListProductImagesCommand {
  readonly userId: string;
  readonly productId: string;
}

// The seller's own images for one product (GET /v1/products/:id/images). The seller-scoped
// `/products` list/detail responses return the plain Product aggregate with no images, so this
// route is what the app uses to show and manage a listing's photos.
@Injectable()
export class ListProductImagesQuery {
  constructor(
    private readonly sellers: SellersService,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
    @Inject(PRODUCT_IMAGE_REPOSITORY) private readonly images: ProductImageRepositoryPort,
  ) {}

  async execute(
    cmd: ListProductImagesCommand,
  ): Promise<Result<ProductImage[], SellerProfileNotFoundError | ProductNotFoundError>> {
    const sellerResult = await this.sellers.getMySeller({ userId: cmd.userId });
    if (!sellerResult.ok) {
      return Err(new SellerProfileNotFoundError(cmd.userId));
    }

    const product = await this.products.findByIdForSeller(
      cmd.productId,
      sellerResult.value.seller.id,
    );
    if (!product) {
      return Err(new ProductNotFoundError(cmd.productId));
    }

    return Ok(await this.images.findByProductIds([product.id]));
  }
}
