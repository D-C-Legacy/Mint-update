import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok } from '../../../../shared/result/result';
import { CATEGORY_REPOSITORY, CategoryRepositoryPort } from '../../domain/ports/category.repository.port';
import { Category } from '../../domain/entities/category.entity';

@Injectable()
export class GetCategoriesQuery {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepositoryPort) {}

  async execute(): Promise<Result<Category[], never>> {
    const categories = await this.categories.listActive();
    return Ok(categories);
  }
}
