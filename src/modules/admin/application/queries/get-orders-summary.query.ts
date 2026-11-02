import { Inject, Injectable } from '@nestjs/common';
import {
  ANALYTICS_REPOSITORY,
  AnalyticsRepositoryPort,
} from '../../domain/ports/analytics.repository.port';
import { OrdersSummaryPoint } from '../../domain/entities/analytics.entity';
import {
  AnalyticsRangeCommand,
  resolveAnalyticsRange,
} from '../../../../shared/analytics/analytics-range.util';

export type GetOrdersSummaryCommand = AnalyticsRangeCommand;

@Injectable()
export class GetOrdersSummaryQuery {
  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly analytics: AnalyticsRepositoryPort) {}

  async execute(cmd: GetOrdersSummaryCommand): Promise<readonly OrdersSummaryPoint[]> {
    return this.analytics.ordersSummary(resolveAnalyticsRange(cmd));
  }
}
