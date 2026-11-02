import { Injectable } from '@nestjs/common';
import { Result } from '../../../shared/result/result';
import {
  CreateProductUseCase,
  CreateProductCommand,
  CreateProductResult,
} from './commands/create-product.usecase';
import {
  UpdateProductUseCase,
  UpdateProductCommand,
  UpdateProductResult,
} from './commands/update-product.usecase';
import {
  ArchiveProductUseCase,
  ArchiveProductCommand,
  ArchiveProductResult,
} from './commands/archive-product.usecase';
import {
  AttachImageUseCase,
  AttachImageCommand,
  AttachImageResult,
} from './commands/attach-image.usecase';
import {
  DetachImageUseCase,
  DetachImageCommand,
  DetachImageResult,
} from './commands/detach-image.usecase';
import {
  SetProductStatusUseCase,
  SetProductStatusResult,
  SetProductStatusError,
} from './commands/set-product-status.usecase';
import {
  RequestImageUploadUseCase,
  RequestImageUploadCommand,
  RequestImageUploadResult,
} from './commands/request-image-upload.usecase';
import { GetProductQuery, GetProductCommand } from './queries/get-product.query';
import { ListProductsQuery, ListProductsCommand } from './queries/list-products.query';
import {
  ListProductImagesQuery,
  ListProductImagesCommand,
} from './queries/list-product-images.query';
import {
  ListPublicProductsQuery,
  ListPublicProductsCommand,
  PublicProductItem,
} from './queries/list-public-products.query';
import { GetPublicProductQuery } from './queries/get-public-product.query';
import { GetCategoriesQuery } from './queries/get-categories.query';
import {
  ReserveStockUseCase,
  ReserveStockCommand,
  ReserveStockResult,
} from './commands/reserve-stock.usecase';
import {
  ReleaseStockUseCase,
  ReleaseStockCommand,
  ReleaseStockResult,
} from './commands/release-stock.usecase';
import { MarkSoldUseCase, MarkSoldCommand, MarkSoldResult } from './commands/mark-sold.usecase';
import { CursorPage } from '../../../shared/pagination/cursor';
import { Product } from '../domain/entities/product.entity';
import { InvalidUploadError } from '../../../platform/storage/upload-policy';
import { ProductImage } from '../domain/entities/product-image.entity';
import { Category } from '../domain/entities/category.entity';
import {
  CategoryNotFoundError,
  InvalidProductQuantityError,
  InvalidStorageKeyError,
  InvalidStockReleaseError,
  OutOfStockError,
  ProductImageNotFoundError,
  ProductNotFoundError,
  SellerNotApprovedError,
  SellerProfileNotFoundError,
  StockNotReservedError,
  UploadRateLimitedError,
} from '../domain/errors/catalog.errors';

@Injectable()
export class CatalogService {
  constructor(
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly archiveProductUseCase: ArchiveProductUseCase,
    private readonly attachImageUseCase: AttachImageUseCase,
    private readonly detachImageUseCase: DetachImageUseCase,
    private readonly setProductStatusUseCase: SetProductStatusUseCase,
    private readonly requestImageUploadUseCase: RequestImageUploadUseCase,
    private readonly getProductQuery: GetProductQuery,
    private readonly listProductsQuery: ListProductsQuery,
    private readonly getCategoriesQuery: GetCategoriesQuery,
    private readonly reserveStockUseCase: ReserveStockUseCase,
    private readonly releaseStockUseCase: ReleaseStockUseCase,
    private readonly markSoldUseCase: MarkSoldUseCase,
    private readonly listPublicProductsQuery: ListPublicProductsQuery,
    private readonly getPublicProductQuery: GetPublicProductQuery,
    private readonly listProductImagesQuery: ListProductImagesQuery,
  ) {}

  async createProduct(
    cmd: CreateProductCommand,
  ): Promise<
    Result<
      CreateProductResult,
      SellerProfileNotFoundError | SellerNotApprovedError | CategoryNotFoundError
    >
  > {
    return this.createProductUseCase.execute(cmd);
  }

  async updateProduct(
    cmd: UpdateProductCommand,
  ): Promise<
    Result<
      UpdateProductResult,
      | SellerProfileNotFoundError
      | SellerNotApprovedError
      | ProductNotFoundError
      | CategoryNotFoundError
      | InvalidProductQuantityError
    >
  > {
    return this.updateProductUseCase.execute(cmd);
  }

  async archiveProduct(
    cmd: ArchiveProductCommand,
  ): Promise<
    Result<
      ArchiveProductResult,
      SellerProfileNotFoundError | SellerNotApprovedError | ProductNotFoundError
    >
  > {
    return this.archiveProductUseCase.execute(cmd);
  }

  async attachImage(
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
    return this.attachImageUseCase.execute(cmd);
  }

  async requestImageUpload(
    cmd: RequestImageUploadCommand,
  ): Promise<
    Result<
      RequestImageUploadResult,
      | SellerProfileNotFoundError
      | SellerNotApprovedError
      | ProductNotFoundError
      | UploadRateLimitedError
      | InvalidUploadError
    >
  > {
    return this.requestImageUploadUseCase.execute(cmd);
  }

  async detachImage(
    cmd: DetachImageCommand,
  ): Promise<
    Result<
      DetachImageResult,
      | SellerProfileNotFoundError
      | SellerNotApprovedError
      | ProductNotFoundError
      | ProductImageNotFoundError
    >
  > {
    return this.detachImageUseCase.execute(cmd);
  }

  async publishProduct(cmd: {
    readonly userId: string;
    readonly productId: string;
  }): Promise<Result<SetProductStatusResult, SetProductStatusError>> {
    return this.setProductStatusUseCase.execute({ ...cmd, status: 'ACTIVE' });
  }

  async unpublishProduct(cmd: {
    readonly userId: string;
    readonly productId: string;
  }): Promise<Result<SetProductStatusResult, SetProductStatusError>> {
    return this.setProductStatusUseCase.execute({ ...cmd, status: 'DRAFT' });
  }

  async listProductImages(
    cmd: ListProductImagesCommand,
  ): Promise<Result<ProductImage[], SellerProfileNotFoundError | ProductNotFoundError>> {
    return this.listProductImagesQuery.execute(cmd);
  }

  async getProduct(
    cmd: GetProductCommand,
  ): Promise<Result<Product, SellerProfileNotFoundError | ProductNotFoundError>> {
    return this.getProductQuery.execute(cmd);
  }

  async listProducts(
    cmd: ListProductsCommand,
  ): Promise<Result<CursorPage<Product>, SellerProfileNotFoundError>> {
    return this.listProductsQuery.execute(cmd);
  }

  async listPublicProducts(cmd: ListPublicProductsCommand): Promise<CursorPage<PublicProductItem>> {
    return this.listPublicProductsQuery.execute(cmd);
  }

  async getPublicProduct(cmd: {
    productId: string;
  }): Promise<Result<PublicProductItem, ProductNotFoundError>> {
    return this.getPublicProductQuery.execute(cmd);
  }

  async getCategories(): Promise<Result<Category[], never>> {
    return this.getCategoriesQuery.execute();
  }

  async reserveStock(
    cmd: ReserveStockCommand,
  ): Promise<Result<ReserveStockResult, OutOfStockError>> {
    return this.reserveStockUseCase.execute(cmd);
  }

  async releaseStock(
    cmd: ReleaseStockCommand,
  ): Promise<Result<ReleaseStockResult, InvalidStockReleaseError>> {
    return this.releaseStockUseCase.execute(cmd);
  }

  async markSold(cmd: MarkSoldCommand): Promise<Result<MarkSoldResult, StockNotReservedError>> {
    return this.markSoldUseCase.execute(cmd);
  }
}
