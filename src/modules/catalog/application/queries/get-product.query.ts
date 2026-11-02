import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SellersService } from '../../../sellers/application/sellers.service';
import { PRODUCT_REPOSITORY, ProductRepositoryPort } from '../../domain/ports/product.repository.port';
import { ProductNotFoundError, SellerProfileNotFoundError } from '../../domain/errors/catalog.errors';
import { Product } from '../../domain/entities/product.entity';

export interface GetProductCommand {
  readonly userId: string;
  readonly productId: string;
}

@Injectable()
export class GetProductQuery {
  constructor(
    private readonly sellers: SellersService,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
  ) {}

  async execute(cmd: GetProductCommand): Promise<Result<Product, SellerProfileNotFoundError | ProductNotFoundError>> {
    const sellerResult = await this.sellers.getMySeller({ userId: cmd.userId });
    if (!sellerResult.ok) {
      return Err(new SellerProfileNotFoundError(cmd.userId));
    }

    const product = await this.products.findByIdForSeller(cmd.productId, sellerResult.value.seller.id);
    if (!product) {
      return Err(new ProductNotFoundError(cmd.productId));
    }

    return Ok(product);
  }
}
