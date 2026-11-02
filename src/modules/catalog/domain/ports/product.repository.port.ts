import type { TransactionClient } from '../../../../platform/database/transaction.manager';
import { Product, ProductCondition, ProductStatus } from '../entities/product.entity';

export const PRODUCT_REPOSITORY = Symbol('ProductRepositoryPort');

export interface CreateProductInput {
  readonly id: string;
  readonly sellerId: string;
  readonly categoryId: string;
  readonly title: string;
  readonly description: string | undefined;
  readonly condition: ProductCondition;
  readonly quantity: number;
  readonly weightGrams: number | undefined;
}

export interface UpdateProductInput {
  readonly categoryId?: string;
  readonly title?: string;
  readonly description?: string;
  readonly condition?: ProductCondition;
  readonly quantity?: number;
  readonly weightGrams?: number;
}

export interface ListProductsFilter {
  readonly sellerId: string;
  readonly status: ProductStatus | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}

// Public catalog (GET /v1/catalog/products): ACTIVE products only, every filter optional.
export interface ListPublicProductsFilter {
  readonly categoryId: string | undefined;
  readonly sellerId: string | undefined;
  readonly q: string | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface ProductRepositoryPort {
  findById(id: string): Promise<Product | null>;
  listPublic(filter: ListPublicProductsFilter): Promise<Product[]>;
  findByIdForSeller(id: string, sellerId: string): Promise<Product | null>;
  list(filter: ListProductsFilter): Promise<Product[]>;
  create(input: CreateProductInput): Promise<Product>;
  update(id: string, input: UpdateProductInput): Promise<Product>;
  archive(id: string): Promise<Product>;
  /** Set the product's status. The caller validates the transition via
   *  `product-status-transition.rule.ts` first; the repository writes whatever it's given. */
  setStatus(id: string, status: ProductStatus): Promise<Product>;
  /** Atomic `reserved += qty` gated on `quantity - reserved >= qty`. Null means the guard failed
   *  (not enough available stock) — per 06-REALTIME-AND-CONCURRENCY.md §7, never distinguished
   *  from "product doesn't exist" here. */
  reserve(productId: string, qty: number): Promise<Product | null>;
  /** Atomic `reserved -= qty` gated on `reserved >= qty`. Null means the guard failed. */
  release(productId: string, qty: number): Promise<Product | null>;
  /** Atomic `reserved -= qty` AND `quantity -= qty` together, gated on both holding `>= qty` —
   *  the "resolved into an order" half of 03-DATA-MODEL.md §4's reservation rule, as opposed to
   *  `release`'s "returned to stock" half. Flagged since P3-03/P5-07, built in P6-02 (order
   *  creation is the first caller). Null means the guard failed. */
  markSold(productId: string, qty: number, trx?: TransactionClient): Promise<Product | null>;
}
