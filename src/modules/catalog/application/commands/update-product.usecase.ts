import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SellersService } from '../../../sellers/application/sellers.service';
import { requireApprovedSellerId } from '../require-approved-seller';
import { PRODUCT_REPOSITORY, ProductRepositoryPort } from '../../domain/ports/product.repository.port';
import { CATEGORY_REPOSITORY, CategoryRepositoryPort } from '../../domain/ports/category.repository.port';
import {
  CategoryNotFoundError,
  InvalidProductQuantityError,
  ProductNotFoundError,
  SellerNotApprovedError,
  SellerProfileNotFoundError,
} from '../../domain/errors/catalog.errors';
import { ProductCondition } from '../../domain/entities/product.entity';

export interface UpdateProductCommand {
  readonly userId: string;
  readonly productId: string;
  readonly categoryId?: string;
  readonly title?: string;
  readonly description?: string;
  readonly condition?: ProductCondition;
  readonly quantity?: number;
  readonly weightGrams?: number;
}

export interface UpdateProductResult {
  readonly productId: string;
}

type UpdateProductError =
  | SellerProfileNotFoundError
  | SellerNotApprovedError
  | ProductNotFoundError
  | CategoryNotFoundError
  | InvalidProductQuantityError;

@Injectable()
export class UpdateProductUseCase {
  constructor(
    private readonly sellers: SellersService,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepositoryPort,
  ) {}

  async execute(cmd: UpdateProductCommand): Promise<Result<UpdateProductResult, UpdateProductError>> {
    const sellerResult = await requireApprovedSellerId(this.sellers, cmd.userId);
    if (!sellerResult.ok) {
      return Err(sellerResult.error);
    }

    const product = await this.products.findByIdForSeller(cmd.productId, sellerResult.value);
    if (!product) {
      return Err(new ProductNotFoundError(cmd.productId));
    }

    if (cmd.categoryId !== undefined) {
      const category = await this.categories.findById(cmd.categoryId);
      if (!category) {
        return Err(new CategoryNotFoundError(cmd.categoryId));
      }
    }

    if (cmd.quantity !== undefined && cmd.quantity < product.reserved) {
      return Err(new InvalidProductQuantityError(cmd.quantity, product.reserved));
    }

    const updated = await this.products.update(product.id, {
      ...(cmd.categoryId !== undefined ? { categoryId: cmd.categoryId } : {}),
      ...(cmd.title !== undefined ? { title: cmd.title } : {}),
      ...(cmd.description !== undefined ? { description: cmd.description } : {}),
      ...(cmd.condition !== undefined ? { condition: cmd.condition } : {}),
      ...(cmd.quantity !== undefined ? { quantity: cmd.quantity } : {}),
      ...(cmd.weightGrams !== undefined ? { weightGrams: cmd.weightGrams } : {}),
    });

    return Ok({ productId: updated.id });
  }
}
