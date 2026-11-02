import { Inject, Injectable } from '@nestjs/common';
import { BID_REPOSITORY, BidRepositoryPort } from '../../domain/ports/bid.repository.port';
import { Bid } from '../../domain/entities/bid.entity';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';

export interface ListBidsCommand {
  readonly saleId: string;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

@Injectable()
export class ListBidsQuery {
  constructor(@Inject(BID_REPOSITORY) private readonly bids: BidRepositoryPort) {}

  async execute(cmd: ListBidsCommand): Promise<CursorPage<Bid>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.bids.findBySaleId({ saleId: cmd.saleId, cursor: cmd.cursor, limit });
    return buildCursorPage(rows, limit);
  }
}
