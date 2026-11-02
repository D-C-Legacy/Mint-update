import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { StorageService } from '../../../../platform/storage/storage.service';
import { SellersService } from '../../../sellers/application/sellers.service';
import { requireApprovedSellerId } from '../require-approved-seller';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '../../domain/ports/product.repository.port';
import {
  PRODUCT_IMAGE_REPOSITORY,
  ProductImageRepositoryPort,
} from '../../domain/ports/product-image.repository.port';
import {
  ProductImageNotFoundError,
  ProductNotFoundError,
  SellerNotApprovedError,
  SellerProfileNotFoundError,
} from '../../domain/errors/catalog.errors';

export interface DetachImageCommand {
  readonly userId: string;
  readonly productId: string;
  readonly imageId: string;
}

export interface DetachImageResult {
  readonly imageId: string;
}

type DetachImageError =
  | SellerProfileNotFoundError
  | SellerNotApprovedError
  | ProductNotFoundError
  | ProductImageNotFoundError;

@Injectable()
export class DetachImageUseCase {
  constructor(
    private readonly sellers: SellersService,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
    @Inject(PRODUCT_IMAGE_REPOSITORY) private readonly images: ProductImageRepositoryPort,
    private readonly storage: StorageService,
  ) {}

  async execute(cmd: DetachImageCommand): Promise<Result<DetachImageResult, DetachImageError>> {
    const sellerResult = await requireApprovedSellerId(this.sellers, cmd.userId);
    if (!sellerResult.ok) {
      return Err(sellerResult.error);
    }

    const product = await this.products.findByIdForSeller(cmd.productId, sellerResult.value);
    if (!product) {
      return Err(new ProductNotFoundError(cmd.productId));
    }

    // Read the key before deleting the row so the object can be removed from S3 too — otherwise
    // the public bucket keeps serving an orphaned image.
    const image = await this.images.findById(cmd.imageId);
    if (!image || image.productId !== product.id) {
      return Err(new ProductImageNotFoundError(cmd.imageId));
    }

    await this.images.deleteForProduct(cmd.imageId, product.id);
    await this.storage.deletePublicObject(image.storageKey);

    return Ok({ imageId: cmd.imageId });
  }
}
