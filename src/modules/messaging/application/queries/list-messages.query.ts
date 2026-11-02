import { Inject, Injectable } from '@nestjs/common';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SellersService } from '../../../sellers/application/sellers.service';
import { MESSAGING_REPOSITORY, MessagingRepositoryPort } from '../../domain/ports/messaging.repository.port';
import { Message } from '../../domain/entities/message.entity';
import { ConversationNotFoundError } from '../../domain/errors/messaging.errors';

export interface ListMessagesCommand {
  readonly conversationId: string;
  readonly userId: string;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

@Injectable()
export class ListMessagesQuery {
  constructor(
    private readonly sellers: SellersService,
    @Inject(MESSAGING_REPOSITORY) private readonly messaging: MessagingRepositoryPort,
  ) {}

  async execute(cmd: ListMessagesCommand): Promise<Result<CursorPage<Message>, ConversationNotFoundError>> {
    const conversation = await this.messaging.findConversationById(cmd.conversationId);
    if (!conversation) {
      return Err(new ConversationNotFoundError(cmd.conversationId));
    }

    const isBuyer = conversation.buyerUserId === cmd.userId;
    if (!isBuyer) {
      const seller = await this.sellers.getSellerById({ sellerId: conversation.sellerId });
      if (!seller || seller.userId !== cmd.userId) {
        return Err(new ConversationNotFoundError(cmd.conversationId));
      }
    }

    const limit = normalizeLimit(cmd.limit);
    const rows = await this.messaging.listMessages({ conversationId: cmd.conversationId, cursor: cmd.cursor, limit });
    return Ok(buildCursorPage(rows, limit));
  }
}
