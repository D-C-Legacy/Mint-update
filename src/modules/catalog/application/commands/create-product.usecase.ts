import { Injectable, Inject } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SellersService } from '../../../sellers/application/sellers.service';
import { requireApprovedSellerId } from '../require-approved-seller';
import { PRODUCT_REPOSITORY, ProductRepositoryPort } from '../../domain/ports/product.repository.port';
import { CATEGORY_REPOSITORY, CategoryRepositoryPort } from '../../domain/ports/category.repository.port';
import {
  CategoryNotFoundError,
  SellerNotApprovedError,
  SellerProfileNotFoundError,
} from '../../domain/errors/catalog.errors';
import { ProductCondition, ProductStatus } from '../../domain/entities/product.entity';

export interface CreateProductCommand {
  readonly userId: string;
  readonly categoryId: string;
  readonly title: string;
  readonly description?: string;
  readonly condition: ProductCondition;
  readonly quantity: number;
  readonly weightGrams?: number;
}

export interface CreateProductResult {
  readonly productId: string;
  readonly status: ProductStatus;
}

@Injectable()
export class CreateProductUseCase {
  constructor(
    private readonly sellers: SellersService,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepositoryPort,
  ) {}

  async execute(
    cmd: CreateProductCommand,
  ): Promise<Result<CreateProductResult, SellerProfileNotFoundError | SellerNotApprovedError | CategoryNotFoundError>> {
    const sellerResult = await requireApprovedSellerId(this.sellers, cmd.userId);
    if (!sellerResult.ok) {
      return Err(sellerResult.error);
    }

    const category = await this.categories.findById(cmd.categoryId);
    if (!category) {
      return Err(new CategoryNotFoundError(cmd.categoryId));
    }

    const product = await this.products.create({
      id: generateId(),
      sellerId: sellerResult.value,
      categoryId: cmd.categoryId,
      title: cmd.title,
      description: cmd.description,
      condition: cmd.condition,
      quantity: cmd.quantity,
      weightGrams: cmd.weightGrams,
    });

    return Ok({ productId: product.id, status: product.status });
  }
}
