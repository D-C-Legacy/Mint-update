import { ProductImage } from '../entities/product-image.entity';

export const PRODUCT_IMAGE_REPOSITORY = Symbol('ProductImageRepositoryPort');

export interface CreateProductImageInput {
  readonly id: string;
  readonly productId: string;
  readonly storageKey: string;
  readonly position: number;
  readonly width: number | undefined;
  readonly height: number | undefined;
}

export interface ProductImageRepositoryPort {
  create(input: CreateProductImageInput): Promise<ProductImage>;
  findById(id: string): Promise<ProductImage | null>;
  deleteForProduct(imageId: string, productId: string): Promise<boolean>;
  countForProduct(productId: string): Promise<number>;
  /** Images for many products in one query, ordered by position (public catalog list). */
  findByProductIds(productIds: readonly string[]): Promise<ProductImage[]>;
}
