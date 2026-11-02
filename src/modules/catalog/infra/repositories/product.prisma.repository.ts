import { Injectable } from '@nestjs/common';
import type { Product as PrismaProduct } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import type { TransactionClient } from '../../../../platform/database/transaction.manager';
import {
  CreateProductInput,
  ListPublicProductsFilter,
  ListProductsFilter,
  ProductRepositoryPort,
  UpdateProductInput,
} from '../../domain/ports/product.repository.port';
import { Product, ProductStatus } from '../../domain/entities/product.entity';
import { toDomainProduct } from '../mappers/product.mapper';

@Injectable()
export class ProductPrismaRepository implements ProductRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Product | null> {
    const row = await this.prisma.product.findUnique({ where: { id } });
    return row ? toDomainProduct(row) : null;
  }

  async listPublic(filter: ListPublicProductsFilter): Promise<Product[]> {
    const rows = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
        ...(filter.sellerId ? { sellerId: filter.sellerId } : {}),
        ...(filter.q ? { title: { contains: filter.q, mode: 'insensitive' } } : {}),
      },
      take: filter.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainProduct);
  }

  async findByIdForSeller(id: string, sellerId: string): Promise<Product | null> {
    const row = await this.prisma.product.findFirst({ where: { id, sellerId } });
    return row ? toDomainProduct(row) : null;
  }

  async list(filter: ListProductsFilter): Promise<Product[]> {
    const rows = await this.prisma.product.findMany({
      where: {
        sellerId: filter.sellerId,
        ...(filter.status ? { status: filter.status } : {}),
      },
      take: filter.limit + 1,
      orderBy: { createdAt: 'desc' },
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainProduct);
  }

  async create(input: CreateProductInput): Promise<Product> {
    const row = await this.prisma.product.create({
      data: {
        id: input.id,
        sellerId: input.sellerId,
        categoryId: input.categoryId,
        title: input.title,
        condition: input.condition,
        quantity: input.quantity,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.weightGrams !== undefined ? { weightGrams: input.weightGrams } : {}),
      },
    });
    return toDomainProduct(row);
  }

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    const row = await this.prisma.product.update({
      where: { id },
      data: {
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.condition !== undefined ? { condition: input.condition } : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.weightGrams !== undefined ? { weightGrams: input.weightGrams } : {}),
      },
    });
    return toDomainProduct(row);
  }

  async archive(id: string): Promise<Product> {
    const row = await this.prisma.product.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
    return toDomainProduct(row);
  }

  async setStatus(id: string, status: ProductStatus): Promise<Product> {
    const row = await this.prisma.product.update({
      where: { id },
      data: { status },
    });
    return toDomainProduct(row);
  }

  // Raw SQL is required here: Prisma's query builder can't express a WHERE clause comparing
  // two columns to each other (quantity - reserved >= qty), only column-to-value. Matches
  // 06-REALTIME-AND-CONCURRENCY.md §7's statement verbatim — single atomic UPDATE, no lock.
  async reserve(productId: string, qty: number): Promise<Product | null> {
    const rows = await this.prisma.$queryRaw<PrismaProduct[]>`
      UPDATE "Product"
      SET reserved = reserved + ${qty}
      WHERE id = ${productId}
        AND quantity - reserved >= ${qty}
      RETURNING *;
    `;
    return rows[0] ? toDomainProduct(rows[0]) : null;
  }

  async release(productId: string, qty: number): Promise<Product | null> {
    const rows = await this.prisma.$queryRaw<PrismaProduct[]>`
      UPDATE "Product"
      SET reserved = reserved - ${qty}
      WHERE id = ${productId}
        AND reserved >= ${qty}
      RETURNING *;
    `;
    return rows[0] ? toDomainProduct(rows[0]) : null;
  }

  async markSold(productId: string, qty: number, trx?: TransactionClient): Promise<Product | null> {
    const rows = await (trx ?? this.prisma).$queryRaw<PrismaProduct[]>`
      UPDATE "Product"
      SET reserved = reserved - ${qty}, quantity = quantity - ${qty}
      WHERE id = ${productId}
        AND reserved >= ${qty}
        AND quantity >= ${qty}
      RETURNING *;
    `;
    return rows[0] ? toDomainProduct(rows[0]) : null;
  }
}
