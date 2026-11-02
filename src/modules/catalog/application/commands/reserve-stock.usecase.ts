import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { PRODUCT_REPOSITORY, ProductRepositoryPort } from '../../domain/ports/product.repository.port';
import { OutOfStockError } from '../../domain/errors/catalog.errors';

export interface ReserveStockCommand {
  readonly productId: string;
  readonly qty: number;
}

export interface ReserveStockResult {
  readonly productId: string;
  readonly reserved: number;
}

@Injectable()
export class ReserveStockUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort) {}

  async execute(cmd: ReserveStockCommand): Promise<Result<ReserveStockResult, OutOfStockError>> {
    if (cmd.qty <= 0) {
      throw new Error(`qty must be positive, got ${cmd.qty}`);
    }

    const product = await this.products.reserve(cmd.productId, cmd.qty);
    if (!product) {
      return Err(new OutOfStockError(cmd.productId, cmd.qty));
    }

    return Ok({ productId: product.id, reserved: product.reserved });
  }
}
