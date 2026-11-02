import { Inject, Injectable } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { SellersService } from '../../../sellers/application/sellers.service';
import { MESSAGING_REPOSITORY, MessagingRepositoryPort } from '../../domain/ports/messaging.repository.port';
import { Conversation } from '../../domain/entities/conversation.entity';
import { SellerCannotMessageSelfError } from '../../domain/errors/messaging.errors';
import { SellerApplicationNotFoundError } from '../../../sellers/domain/errors/sellers.errors';
import { messageCreatedEvent } from '../../events/published/message-created.event';

export interface StartConversationCommand {
  readonly buyerUserId: string;
  readonly sellerId: string;
  readonly body: string;
}

// POST /v1/me/conversations — not in 05-API-SPEC.md (no messaging model exists in the docs at
// all). Buyer-initiated only: the founder's own description was "ask a seller a question", and a
// seller cold-messaging a buyer first was never asked for — flagged as a scope choice, not an
// oversight. find-or-create is idempotent: messaging the same seller twice reuses one thread,
// same precedent as Device.upsertByPushToken.
@Injectable()
export class StartConversationUseCase {
  constructor(
    private readonly sellers: SellersService,
    @Inject(MESSAGING_REPOSITORY) private readonly messaging: MessagingRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(
    cmd: StartConversationCommand,
  ): Promise<Result<Conversation, SellerApplicationNotFoundError | SellerCannotMessageSelfError>> {
    const seller = await this.sellers.getSellerById({ sellerId: cmd.sellerId });
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`seller ${cmd.sellerId}`));
    }
    if (seller.userId === cmd.buyerUserId) {
      return Err(new SellerCannotMessageSelfError());
    }

    const conversation = await this.messaging.findOrCreateConversation({
      id: generateId(),
      buyerUserId: cmd.buyerUserId,
      sellerId: cmd.sellerId,
    });

    const message = await this.messaging.createMessage({
      id: generateId(),
      conversationId: conversation.id,
      senderUserId: cmd.buyerUserId,
      body: cmd.body,
      markUnreadForSeller: true,
    });

    await this.eventBus.publish(
      messageCreatedEvent({
        conversationId: conversation.id,
        messageId: message.id,
        senderUserId: cmd.buyerUserId,
        recipientUserId: seller.userId,
        body: cmd.body,
        createdAt: message.createdAt.toISOString(),
      }),
    );

    return Ok(conversation);
  }
}
