import { Inject, Injectable } from '@nestjs/common';
import { ANALYTICS_REPOSITORY, AnalyticsRepositoryPort } from '../../domain/ports/analytics.repository.port';
import { PayoutStatusSummary } from '../../domain/entities/analytics.entity';

@Injectable()
export class GetPayoutsSummaryQuery {
  constructor(@Inject(ANALYTICS_REPOSITORY) private readonly analytics: AnalyticsRepositoryPort) {}

  async execute(): Promise<readonly PayoutStatusSummary[]> {
    return this.analytics.payoutsSummary();
  }
}
