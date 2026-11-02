import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateProductImageInput,
  ProductImageRepositoryPort,
} from '../../domain/ports/product-image.repository.port';
import { ProductImage } from '../../domain/entities/product-image.entity';
import { toDomainProductImage } from '../mappers/product-image.mapper';

@Injectable()
export class ProductImagePrismaRepository implements ProductImageRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateProductImageInput): Promise<ProductImage> {
    const row = await this.prisma.productImage.create({
      data: {
        id: input.id,
        productId: input.productId,
        storageKey: input.storageKey,
        position: input.position,
        ...(input.width !== undefined ? { width: input.width } : {}),
        ...(input.height !== undefined ? { height: input.height } : {}),
      },
    });
    return toDomainProductImage(row);
  }

  async findById(id: string): Promise<ProductImage | null> {
    const row = await this.prisma.productImage.findUnique({ where: { id } });
    return row ? toDomainProductImage(row) : null;
  }

  async deleteForProduct(imageId: string, productId: string): Promise<boolean> {
    const result = await this.prisma.productImage.deleteMany({
      where: { id: imageId, productId },
    });
    return result.count > 0;
  }

  async countForProduct(productId: string): Promise<number> {
    return this.prisma.productImage.count({ where: { productId } });
  }

  async findByProductIds(productIds: readonly string[]): Promise<ProductImage[]> {
    const rows = await this.prisma.productImage.findMany({
      where: { productId: { in: [...productIds] } },
      orderBy: [{ productId: 'asc' }, { position: 'asc' }],
    });
    return rows.map(toDomainProductImage);
  }
}
