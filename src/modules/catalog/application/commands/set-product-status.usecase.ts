import { Injectable, Inject } from '@nestjs/common';
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
  InvalidProductStatusError,
  ProductNotPublishableError,
  ProductNotFoundError,
  SellerNotApprovedError,
  SellerProfileNotFoundError,
} from '../../domain/errors/catalog.errors';
import { ProductStatus } from '../../domain/entities/product.entity';
import { transitionProductStatus } from '../../domain/rules/product-status-transition.rule';

// Only DRAFT<->ACTIVE is reachable through this use case. ARCHIVED stays terminal (it is a
// separate, deliberate action), and SOLD is set by the order flow.
export type SetProductStatusTarget = 'ACTIVE' | 'DRAFT';

export interface SetProductStatusCommand {
  readonly userId: string;
  readonly productId: string;
  readonly status: SetProductStatusTarget;
}

export interface SetProductStatusResult {
  readonly productId: string;
  readonly status: ProductStatus;
}

export type SetProductStatusError =
  | SellerProfileNotFoundError
  | SellerNotApprovedError
  | ProductNotFoundError
  | InvalidProductStatusError
  | ProductNotPublishableError;

@Injectable()
export class SetProductStatusUseCase {
  constructor(
    private readonly sellers: SellersService,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
    @Inject(PRODUCT_IMAGE_REPOSITORY) private readonly images: ProductImageRepositoryPort,
  ) {}

  async execute(
    cmd: SetProductStatusCommand,
  ): Promise<Result<SetProductStatusResult, SetProductStatusError>> {
    const sellerResult = await requireApprovedSellerId(this.sellers, cmd.userId);
    if (!sellerResult.ok) {
      return Err(sellerResult.error);
    }

    const product = await this.products.findByIdForSeller(cmd.productId, sellerResult.value);
    if (!product) {
      return Err(new ProductNotFoundError(cmd.productId));
    }

    const transition = transitionProductStatus(
      cmd.status === 'ACTIVE' ? 'PUBLISH' : 'UNPUBLISH',
      product.status,
    );
    if (!transition.ok) {
      return Err(transition.error);
    }

    // A product can only go live with at least one attached photo — confirmed by the user, see
    // ProductNotPublishableError's comment.
    if (cmd.status === 'ACTIVE') {
      const imageCount = await this.images.countForProduct(product.id);
      if (imageCount === 0) {
        return Err(new ProductNotPublishableError(product.id));
      }
    }

    const updated = await this.products.setStatus(product.id, cmd.status);
    return Ok({ productId: updated.id, status: updated.status });
  }
}
