import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SellersService } from '../../../sellers/application/sellers.service';
import { requireApprovedSellerId } from '../require-approved-seller';
import { PRODUCT_REPOSITORY, ProductRepositoryPort } from '../../domain/ports/product.repository.port';
import {
  ProductNotFoundError,
  SellerNotApprovedError,
  SellerProfileNotFoundError,
} from '../../domain/errors/catalog.errors';
import { ProductStatus } from '../../domain/entities/product.entity';

export interface ArchiveProductCommand {
  readonly userId: string;
  readonly productId: string;
}

export interface ArchiveProductResult {
  readonly productId: string;
  readonly status: ProductStatus;
}

@Injectable()
export class ArchiveProductUseCase {
  constructor(
    private readonly sellers: SellersService,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
  ) {}

  async execute(
    cmd: ArchiveProductCommand,
  ): Promise<Result<ArchiveProductResult, SellerProfileNotFoundError | SellerNotApprovedError | ProductNotFoundError>> {
    const sellerResult = await requireApprovedSellerId(this.sellers, cmd.userId);
    if (!sellerResult.ok) {
      return Err(sellerResult.error);
    }

    const product = await this.products.findByIdForSeller(cmd.productId, sellerResult.value);
    if (!product) {
      return Err(new ProductNotFoundError(cmd.productId));
    }

    const archived = await this.products.archive(product.id);
    return Ok({ productId: archived.id, status: archived.status });
  }
}
