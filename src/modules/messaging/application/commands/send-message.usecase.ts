import { Inject, Injectable } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { SellersService } from '../../../sellers/application/sellers.service';
import { MESSAGING_REPOSITORY, MessagingRepositoryPort } from '../../domain/ports/messaging.repository.port';
import { Message } from '../../domain/entities/message.entity';
import { ConversationNotFoundError } from '../../domain/errors/messaging.errors';
import { messageCreatedEvent } from '../../events/published/message-created.event';

export interface SendMessageCommand {
  readonly conversationId: string;
  readonly senderUserId: string;
  readonly body: string;
}

// POST /v1/me/conversations/:id/messages — a reply from either side of an existing thread.
// Membership is resolved here rather than stored redundantly: the buyer side is a direct id
// match, the seller side needs one SellersService lookup to turn Conversation.sellerId into the
// user id that's actually allowed to reply. Anyone else gets the same masked 404 every other
// ownership check in this codebase uses.
@Injectable()
export class SendMessageUseCase {
  constructor(
    private readonly sellers: SellersService,
    @Inject(MESSAGING_REPOSITORY) private readonly messaging: MessagingRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(cmd: SendMessageCommand): Promise<Result<Message, ConversationNotFoundError>> {
    const conversation = await this.messaging.findConversationById(cmd.conversationId);
    if (!conversation) {
      return Err(new ConversationNotFoundError(cmd.conversationId));
    }

    let recipientUserId: string;
    let markUnreadForSeller: boolean;

    if (conversation.buyerUserId === cmd.senderUserId) {
      const seller = await this.sellers.getSellerById({ sellerId: conversation.sellerId });
      if (!seller) {
        return Err(new ConversationNotFoundError(cmd.conversationId));
      }
      recipientUserId = seller.userId;
      markUnreadForSeller = true;
    } else {
      const seller = await this.sellers.getSellerById({ sellerId: conversation.sellerId });
      if (!seller || seller.userId !== cmd.senderUserId) {
        return Err(new ConversationNotFoundError(cmd.conversationId));
      }
      recipientUserId = conversation.buyerUserId;
      markUnreadForSeller = false;
    }

    const message = await this.messaging.createMessage({
      id: generateId(),
      conversationId: conversation.id,
      senderUserId: cmd.senderUserId,
      body: cmd.body,
      markUnreadForSeller,
    });

    await this.eventBus.publish(
      messageCreatedEvent({
        conversationId: conversation.id,
        messageId: message.id,
        senderUserId: cmd.senderUserId,
        recipientUserId,
        body: cmd.body,
        createdAt: message.createdAt.toISOString(),
      }),
    );

    return Ok(message);
  }
}
