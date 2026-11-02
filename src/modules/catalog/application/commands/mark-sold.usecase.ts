import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { PRODUCT_REPOSITORY, ProductRepositoryPort } from '../../domain/ports/product.repository.port';
import { StockNotReservedError } from '../../domain/errors/catalog.errors';

import type { TransactionClient } from '../../../../platform/database/transaction.manager';

export interface MarkSoldCommand {
  readonly productId: string;
  readonly qty: number;
  // When given, the stock change joins the caller's transaction (order creation uses this, so the
  // stock and the order commit or roll back together).
  readonly trx: TransactionClient | undefined;
}

export interface MarkSoldResult {
  readonly productId: string;
  readonly quantity: number;
  readonly reserved: number;
}

@Injectable()
export class MarkSoldUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort) {}

  async execute(cmd: MarkSoldCommand): Promise<Result<MarkSoldResult, StockNotReservedError>> {
    if (cmd.qty <= 0) {
      throw new Error(`qty must be positive, got ${cmd.qty}`);
    }

    const product = await this.products.markSold(cmd.productId, cmd.qty, cmd.trx);
    if (!product) {
      return Err(new StockNotReservedError(cmd.productId, cmd.qty));
    }

    return Ok({ productId: product.id, quantity: product.quantity, reserved: product.reserved });
  }
}
