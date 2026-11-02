import { Inject, Injectable } from '@nestjs/common';
import { BID_REPOSITORY, BidRepositoryPort } from '../../domain/ports/bid.repository.port';
import { Bid } from '../../domain/entities/bid.entity';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';

export interface ListMyBidsCommand {
  readonly userId: string;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// The signed-in buyer's own bids across every sale (GET /v1/me/bids).
@Injectable()
export class ListMyBidsQuery {
  constructor(@Inject(BID_REPOSITORY) private readonly bids: BidRepositoryPort) {}

  async execute(cmd: ListMyBidsCommand): Promise<CursorPage<Bid>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.bids.findByUserId({ userId: cmd.userId, cursor: cmd.cursor, limit });
    return buildCursorPage(rows, limit);
  }
}
