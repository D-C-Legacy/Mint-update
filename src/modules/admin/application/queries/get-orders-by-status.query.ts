import { Inject, Injectable } from '@nestjs/common';
import { ANALYTICS_REPOSITORY, AnalyticsRepositoryPort } from '../../domain/ports/analytics.repository.port';
import { StatusCount } from '../../domain/entities/analytics.entity';

@Injectable()
export class GetOrdersByStatusQuery {
  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly analytics: AnalyticsRepositoryPort) {}

  async execute(): Promise<readonly StatusCount[]> {
    return this.analytics.ordersByStatus();
  }
}
