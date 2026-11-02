import { Category } from '../entities/category.entity';

export const CATEGORY_REPOSITORY = Symbol('CategoryRepositoryPort');

export interface CategoryRepositoryPort {
  findById(id: string): Promise<Category | null>;
  listActive(): Promise<Category[]>;
}
