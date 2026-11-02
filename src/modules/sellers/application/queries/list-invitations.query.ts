import { Injectable, Inject } from '@nestjs/common';
import { CursorPage } from '../../../../shared/pagination/cursor';
import {
  SELLER_INVITATION_REPOSITORY,
  SellerInvitationRepositoryPort,
} from '../../domain/ports/seller-team.repository.port';
import { SellerInvitation, SellerInvitationStatus } from '../../domain/entities/seller-team.entity';

export interface ListInvitationsCommand {
  readonly sellerId: string;
  readonly status: SellerInvitationStatus | undefined;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

export interface ListInvitationsQuery {
  execute(cmd: ListInvitationsCommand): Promise<CursorPage<SellerInvitation>>;
}

@Injectable()
export class ListInvitationsQueryImpl implements ListInvitationsQuery {
  constructor(
    @Inject(SELLER_INVITATION_REPOSITORY)
    private readonly invitations: SellerInvitationRepositoryPort,
  ) {}

  async execute(cmd: ListInvitationsCommand): Promise<CursorPage<SellerInvitation>> {
    const DEFAULT_LIMIT = 20;
    const MAX_LIMIT = 100;
    const limit = cmd.limit ? Math.min(Math.max(cmd.limit, 1), MAX_LIMIT) : DEFAULT_LIMIT;

    const items = await this.invitations.list({
      sellerId: cmd.sellerId,
      status: cmd.status,
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
