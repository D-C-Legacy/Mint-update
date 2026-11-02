import { Inject, Injectable } from '@nestjs/common';
import {
  SALE_REPOSITORY,
  SaleRepositoryPort,
  SessionSalesStats,
} from '../../domain/ports/sale.repository.port';

export interface GetSessionSalesStatsCommand {
  readonly sessionId: string;
}

// Streaming module's SessionStatsFinalizer calls this (via SalesService) when a stream ends, to
// fill in StreamSession.itemsSold/grossAmount — same cross-module shape as every other
// Streaming -> Sales call (StreamingModule already imports SalesModule).
@Injectable()
export class GetSessionSalesStatsQuery {
  constructor(@Inject(SALE_REPOSITORY) private readonly sales: SaleRepositoryPort) {}

  async execute(cmd: GetSessionSalesStatsCommand): Promise<SessionSalesStats> {
    return this.sales.getSessionSalesStats(cmd.sessionId);
  }
}
