import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { PRODUCT_REPOSITORY, ProductRepositoryPort } from '../../domain/ports/product.repository.port';
import { InvalidStockReleaseError } from '../../domain/errors/catalog.errors';

export interface ReleaseStockCommand {
  readonly productId: string;
  readonly qty: number;
}

export interface ReleaseStockResult {
  readonly productId: string;
  readonly reserved: number;
}

@Injectable()
export class ReleaseStockUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort) {}

  async execute(cmd: ReleaseStockCommand): Promise<Result<ReleaseStockResult, InvalidStockReleaseError>> {
    if (cmd.qty <= 0) {
      throw new Error(`qty must be positive, got ${cmd.qty}`);
    }

    const product = await this.products.release(cmd.productId, cmd.qty);
    if (!product) {
      return Err(new InvalidStockReleaseError(cmd.productId, cmd.qty));
    }

    return Ok({ productId: product.id, reserved: product.reserved });
  }
}
