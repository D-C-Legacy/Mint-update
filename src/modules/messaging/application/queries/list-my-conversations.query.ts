import { Inject, Injectable } from '@nestjs/common';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { SellersService } from '../../../sellers/application/sellers.service';
import { MESSAGING_REPOSITORY, MessagingRepositoryPort } from '../../domain/ports/messaging.repository.port';
import { Conversation } from '../../domain/entities/conversation.entity';

export interface ListMyConversationsCommand {
  readonly userId: string;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// GET /v1/me/conversations — every thread where the caller is the buyer, plus every thread where
// they're the seller (if they have an approved-or-not seller row at all; resolving it here with
// SellersService rather than a direct repository call, per this project's own cross-module rule).
@Injectable()
export class ListMyConversationsQuery {
  constructor(
    private readonly sellers: SellersService,
    @Inject(MESSAGING_REPOSITORY) private readonly messaging: MessagingRepositoryPort,
  ) {}

  async execute(cmd: ListMyConversationsCommand): Promise<CursorPage<Conversation>> {
    const sellerResult = await this.sellers.getMySeller({ userId: cmd.userId });
    const sellerId = sellerResult.ok ? sellerResult.value.seller.id : null;

    const limit = normalizeLimit(cmd.limit);
    const rows = await this.messaging.listConversationsForUser({
      buyerUserId: cmd.userId,
      sellerId,
      cursor: cmd.cursor,
      limit,
    });
    return buildCursorPage(rows, limit);
  }
}
