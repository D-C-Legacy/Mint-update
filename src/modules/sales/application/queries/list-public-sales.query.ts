import { Inject, Injectable } from '@nestjs/common';
import { SALE_REPOSITORY, SaleRepositoryPort } from '../../domain/ports/sale.repository.port';
import { Sale, SaleMode, SaleStatus } from '../../domain/entities/sale.entity';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';

export interface ListPublicSalesCommand {
  readonly mode: SaleMode | undefined;
  readonly productId: string | undefined;
  readonly status: SaleStatus | undefined;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// Public sale directory (GET /v1/sales). Defaults to OPEN sales: the things a buyer can act on.
@Injectable()
export class ListPublicSalesQuery {
  constructor(@Inject(SALE_REPOSITORY) private readonly sales: SaleRepositoryPort) {}

  async execute(cmd: ListPublicSalesCommand): Promise<CursorPage<Sale>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.sales.listPublic({
      mode: cmd.mode,
      productId: cmd.productId,
      status: cmd.status ?? 'OPEN',
      cursor: cmd.cursor,
      limit,
    });
    return buildCursorPage(rows, limit);
  }
}
