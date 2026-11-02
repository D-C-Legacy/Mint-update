import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CatalogService } from '../../application/catalog.service';
import { StorageService } from '../../../../platform/storage/storage.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { CreateProductSchema, CreateProductDto } from './dto/create-product.dto';
import { UpdateProductSchema, UpdateProductDto } from './dto/update-product.dto';
import { RequestImageUploadSchema, RequestImageUploadDto } from './dto/request-image-upload.dto';
import { AttachImageSchema, AttachImageDto } from './dto/attach-image.dto';
import { ListProductsQuerySchema, ListProductsQueryDto } from './dto/list-products-query.dto';

@Controller()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly storage: StorageService,
  ) {}

  @Get('categories')
  async getCategories(): Promise<{ data: unknown }> {
    const result = await this.catalog.getCategories();
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('products')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async createProduct(
    @Body(new ZodValidationPipe(CreateProductSchema)) dto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.catalog.createProduct({
      userId: user.id,
      categoryId: dto.categoryId,
      title: dto.title,
      condition: dto.condition,
      quantity: dto.quantity,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.weightGrams !== undefined ? { weightGrams: dto.weightGrams } : {}),
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Get('products')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async listProducts(
    @Query(new ZodValidationPipe(ListProductsQuerySchema)) query: ListProductsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.catalog.listProducts({
      userId: user.id,
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Get('products/:id')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async getProduct(
    @Param('id') productId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.catalog.getProduct({ userId: user.id, productId });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Patch('products/:id')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async updateProduct(
    @Param('id') productId: string,
    @Body(new ZodValidationPipe(UpdateProductSchema)) dto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.catalog.updateProduct({
      userId: user.id,
      productId,
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
      ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
      ...(dto.weightGrams !== undefined ? { weightGrams: dto.weightGrams } : {}),
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Delete('products/:id')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async archiveProduct(
    @Param('id') productId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.catalog.archiveProduct({ userId: user.id, productId });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  // No DefaultRateLimitGuard — RequestImageUploadUseCase already checks the more specific
  // "Upload URL requests: 20/min per user" scope (05-API-SPEC.md §13) itself.
  @Post('products/:id/images/upload-url')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  async requestImageUpload(
    @Param('id') productId: string,
    @Body(new ZodValidationPipe(RequestImageUploadSchema)) dto: RequestImageUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.catalog.requestImageUpload({
      userId: user.id,
      productId,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('products/:id/images')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async attachImage(
    @Param('id') productId: string,
    @Body(new ZodValidationPipe(AttachImageSchema)) dto: AttachImageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.catalog.attachImage({
      userId: user.id,
      productId,
      storageKey: dto.storageKey,
      ...(dto.width !== undefined ? { width: dto.width } : {}),
      ...(dto.height !== undefined ? { height: dto.height } : {}),
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Delete('products/:id/images/:imageId')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async detachImage(
    @Param('id') productId: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.catalog.detachImage({ userId: user.id, productId, imageId });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Get('products/:id/images')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async listProductImages(
    @Param('id') productId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.catalog.listProductImages({ userId: user.id, productId });
    if (!result.ok) throw toHttpException(result.error);
    const items = result.value.map((image) => ({
      id: image.id,
      url: this.storage.getPublicUrl(image.storageKey),
      position: image.position,
      width: image.width,
      height: image.height,
    }));
    return { data: { items } };
  }

  // Publish/unpublish a listing (DRAFT<->ACTIVE). Publishing requires at least one attached image
  // (ProductNotPublishableError, 409) — confirmed by the user (Hammas) 15 Oct 2026, not a founder
  // instruction (prompt.md's original note was only his own speculation about the natural trigger).
  @Post('products/:id/publish')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async publishProduct(
    @Param('id') productId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.catalog.publishProduct({ userId: user.id, productId });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('products/:id/unpublish')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async unpublishProduct(
    @Param('id') productId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.catalog.unpublishProduct({ userId: user.id, productId });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }
}
