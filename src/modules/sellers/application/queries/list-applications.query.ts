import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok } from '../../../../shared/result/result';
import { CursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import { ApplicationDecision } from '../../domain/entities/seller.entity';
import { SellerApplicationSummary } from '../../domain/entities/seller-application-summary.entity';

export interface ListApplicationsCommand {
  readonly decision: ApplicationDecision | undefined;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

@Injectable()
export class ListApplicationsQuery {
  constructor(@Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort) {}

  async execute(cmd: ListApplicationsCommand): Promise<Result<CursorPage<SellerApplicationSummary>, never>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.sellers.listApplications({ decision: cmd.decision, cursor: cmd.cursor, limit });

    // buildCursorPage assumes an `id` field; this list's natural key is `applicationId`, so paginate inline.
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];

    return Ok({ items, nextCursor: hasMore && last ? last.applicationId : null });
  }
}
