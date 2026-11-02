import { Inject, Injectable } from '@nestjs/common';
import {
  ANALYTICS_REPOSITORY,
  AnalyticsRepositoryPort,
} from '../../domain/ports/analytics.repository.port';
import { SellersSummary } from '../../domain/entities/analytics.entity';
import {
  AnalyticsRangeCommand,
  resolveAnalyticsRange,
} from '../../../../shared/analytics/analytics-range.util';

export type GetSellersSummaryCommand = AnalyticsRangeCommand;

@Injectable()
export class GetSellersSummaryQuery {
  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly analytics: AnalyticsRepositoryPort) {}

  async execute(cmd: GetSellersSummaryCommand): Promise<SellersSummary> {
    return this.analytics.sellersSummary(resolveAnalyticsRange(cmd));
  }
}
