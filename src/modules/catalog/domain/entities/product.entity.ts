export type ProductCondition = 'NEW' | 'LIKE_NEW' | 'USED' | 'FOR_PARTS';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'SOLD' | 'ARCHIVED';

export interface Product {
  readonly id: string;
  readonly sellerId: string;
  readonly categoryId: string;
  readonly title: string;
  readonly description: string | null;
  readonly condition: ProductCondition;
  readonly status: ProductStatus;
  readonly quantity: number;
  readonly reserved: number;
  readonly weightGrams: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
