import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { SellersModule } from '../sellers/sellers.module';
import { PRODUCT_REPOSITORY } from './domain/ports/product.repository.port';
import { PRODUCT_IMAGE_REPOSITORY } from './domain/ports/product-image.repository.port';
import { CATEGORY_REPOSITORY } from './domain/ports/category.repository.port';
import { ProductPrismaRepository } from './infra/repositories/product.prisma.repository';
import { ProductImagePrismaRepository } from './infra/repositories/product-image.prisma.repository';
import { CategoryPrismaRepository } from './infra/repositories/category.prisma.repository';
import { CreateProductUseCase } from './application/commands/create-product.usecase';
import { UpdateProductUseCase } from './application/commands/update-product.usecase';
import { ArchiveProductUseCase } from './application/commands/archive-product.usecase';
import { AttachImageUseCase } from './application/commands/attach-image.usecase';
import { DetachImageUseCase } from './application/commands/detach-image.usecase';
import { SetProductStatusUseCase } from './application/commands/set-product-status.usecase';
import { RequestImageUploadUseCase } from './application/commands/request-image-upload.usecase';
import { GetProductQuery } from './application/queries/get-product.query';
import { ListProductsQuery } from './application/queries/list-products.query';
import { ListProductImagesQuery } from './application/queries/list-product-images.query';
import { GetCategoriesQuery } from './application/queries/get-categories.query';
import { ReserveStockUseCase } from './application/commands/reserve-stock.usecase';
import { ReleaseStockUseCase } from './application/commands/release-stock.usecase';
import { MarkSoldUseCase } from './application/commands/mark-sold.usecase';
import { CatalogService } from './application/catalog.service';
import { CatalogController } from './api/http/catalog.controller';
import { PublicCatalogController } from './api/http/public-catalog.controller';
import { ListPublicProductsQuery } from './application/queries/list-public-products.query';
import { GetPublicProductQuery } from './application/queries/get-public-product.query';

@Module({
  imports: [DatabaseModule, StorageModule, AuthModule, RateLimitModule, SellersModule],
  controllers: [CatalogController, PublicCatalogController],
  providers: [
    ListPublicProductsQuery,
    GetPublicProductQuery,
    { provide: PRODUCT_REPOSITORY, useClass: ProductPrismaRepository },
    { provide: PRODUCT_IMAGE_REPOSITORY, useClass: ProductImagePrismaRepository },
    { provide: CATEGORY_REPOSITORY, useClass: CategoryPrismaRepository },
    CreateProductUseCase,
    UpdateProductUseCase,
    ArchiveProductUseCase,
    AttachImageUseCase,
    DetachImageUseCase,
    SetProductStatusUseCase,
    RequestImageUploadUseCase,
    GetProductQuery,
    ListProductsQuery,
    ListProductImagesQuery,
    GetCategoriesQuery,
    ReserveStockUseCase,
    ReleaseStockUseCase,
    MarkSoldUseCase,
    CatalogService,
  ],
  exports: [CatalogService],
})
export class CatalogModule {}
