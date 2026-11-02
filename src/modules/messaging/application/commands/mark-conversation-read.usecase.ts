import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SellersService } from '../../../sellers/application/sellers.service';
import { MESSAGING_REPOSITORY, MessagingRepositoryPort } from '../../domain/ports/messaging.repository.port';
import { Conversation } from '../../domain/entities/conversation.entity';
import { ConversationNotFoundError } from '../../domain/errors/messaging.errors';

export interface MarkConversationReadCommand {
  readonly conversationId: string;
  readonly userId: string;
}

@Injectable()
export class MarkConversationReadUseCase {
  constructor(
    private readonly sellers: SellersService,
    @Inject(MESSAGING_REPOSITORY) private readonly messaging: MessagingRepositoryPort,
  ) {}

  async execute(cmd: MarkConversationReadCommand): Promise<Result<Conversation, ConversationNotFoundError>> {
    const conversation = await this.messaging.findConversationById(cmd.conversationId);
    if (!conversation) {
      return Err(new ConversationNotFoundError(cmd.conversationId));
    }

    let side: 'BUYER' | 'SELLER';
    if (conversation.buyerUserId === cmd.userId) {
      side = 'BUYER';
    } else {
      const seller = await this.sellers.getSellerById({ sellerId: conversation.sellerId });
      if (!seller || seller.userId !== cmd.userId) {
        return Err(new ConversationNotFoundError(cmd.conversationId));
      }
      side = 'SELLER';
    }

    const updated = await this.messaging.markRead(cmd.conversationId, side);
    if (!updated) {
      return Err(new ConversationNotFoundError(cmd.conversationId));
    }
    return Ok(updated);
  }
}
