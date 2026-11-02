import { Injectable, Inject } from '@nestjs/common';
import { CursorPage } from '../../../../shared/pagination/cursor';
import {
  SELLER_TEAM_REPOSITORY,
  SellerTeamRepositoryPort,
} from '../../domain/ports/seller-team.repository.port';
import { SellerTeamMember } from '../../domain/entities/seller-team.entity';

export interface ListTeamMembersCommand {
  readonly sellerId: string;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

export interface ListTeamMembersQuery {
  execute(cmd: ListTeamMembersCommand): Promise<CursorPage<SellerTeamMember>>;
}

@Injectable()
export class ListTeamMembersQueryImpl implements ListTeamMembersQuery {
  constructor(@Inject(SELLER_TEAM_REPOSITORY) private readonly team: SellerTeamRepositoryPort) {}

  async execute(cmd: ListTeamMembersCommand): Promise<CursorPage<SellerTeamMember>> {
    const DEFAULT_LIMIT = 20;
    const MAX_LIMIT = 100;
    const limit = cmd.limit ? Math.min(Math.max(cmd.limit, 1), MAX_LIMIT) : DEFAULT_LIMIT;

    const items = await this.team.list({
      sellerId: cmd.sellerId,
      cursor: cmd.cursor,
      limit,
    });

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    const last = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && last ? last.id : null;

    return { items: pageItems, nextCursor };
  }
}
