import { Injectable, Inject } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
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
  InvalidStorageKeyError,
  ProductNotFoundError,
  SellerNotApprovedError,
  SellerProfileNotFoundError,
} from '../../domain/errors/catalog.errors';

export interface AttachImageCommand {
  readonly userId: string;
  readonly productId: string;
  readonly storageKey: string;
  readonly width?: number;
  readonly height?: number;
}

export interface AttachImageResult {
  readonly imageId: string;
}

// A storage key is only ever minted by RequestImageUploadUseCase for a product the caller owns, so
// a key from any other product is rejected before it can be attached — a seller can't point their
// listing at another product's (or another seller's) object.
const STORAGE_KEY_PREFIX = 'products/';

@Injectable()
export class AttachImageUseCase {
  constructor(
    private readonly sellers: SellersService,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
    @Inject(PRODUCT_IMAGE_REPOSITORY) private readonly images: ProductImageRepositoryPort,
  ) {}

  async execute(
    cmd: AttachImageCommand,
  ): Promise<
    Result<
      AttachImageResult,
      | SellerProfileNotFoundError
      | SellerNotApprovedError
      | ProductNotFoundError
      | InvalidStorageKeyError
    >
  > {
    const sellerResult = await requireApprovedSellerId(this.sellers, cmd.userId);
    if (!sellerResult.ok) {
      return Err(sellerResult.error);
    }

    const product = await this.products.findByIdForSeller(cmd.productId, sellerResult.value);
    if (!product) {
      return Err(new ProductNotFoundError(cmd.productId));
    }

    if (!cmd.storageKey.startsWith(`${STORAGE_KEY_PREFIX}${product.id}/`)) {
      return Err(new InvalidStorageKeyError(product.id));
    }

    const position = await this.images.countForProduct(product.id);
    const image = await this.images.create({
      id: generateId(),
      productId: product.id,
      storageKey: cmd.storageKey,
      position,
      width: cmd.width,
      height: cmd.height,
    });

    return Ok({ imageId: image.id });
  }
}
