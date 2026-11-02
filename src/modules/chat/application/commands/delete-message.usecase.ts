import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  CHAT_MESSAGE_REPOSITORY,
  ChatMessageRepositoryPort,
} from '../../domain/ports/chat-message.repository.port';
import { ChatMessageNotFoundError } from '../../domain/errors/chat.errors';
import { ChatCacheService } from '../../infra/chat-cache.service';
import { chatMessageDeletedEvent } from '../../events/published/chat-message-deleted.event';

export interface DeleteMessageCommand {
  readonly messageId: string;
  readonly deletedByUserId: string;
}

export interface DeleteMessageResult {
  readonly sessionId: string;
  readonly messageId: string;
}

// 05-API-SPEC.md §11 `POST /admin/chat/messages/:id/delete` — the broadcast side (`chat.deleted`
// to the room) has to happen from wherever a live Socket.IO server exists, which this use case
// (reached from an HTTP admin route) doesn't have. Publishes a domain event instead, exactly the
// documented pattern for this (06-REALTIME-AND-CONCURRENCY.md §3: "Use the platform PubSubService
// for non-socket cross-process signals") — ChatGateway subscribes and does the actual emit.
@Injectable()
export class DeleteMessageUseCase {
  constructor(
    @Inject(CHAT_MESSAGE_REPOSITORY) private readonly messages: ChatMessageRepositoryPort,
    private readonly cache: ChatCacheService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(cmd: DeleteMessageCommand): Promise<Result<DeleteMessageResult, ChatMessageNotFoundError>> {
    const existing = await this.messages.findById(cmd.messageId);
    if (!existing) {
      return Err(new ChatMessageNotFoundError(cmd.messageId));
    }

    const updated = await this.messages.markDeleted(cmd.messageId, cmd.deletedByUserId);
    await this.cache.removeMessage(updated.sessionId, updated.id);
    await this.eventBus.publish(
      chatMessageDeletedEvent({ sessionId: updated.sessionId, messageId: updated.id }),
    );

    return Ok({ sessionId: updated.sessionId, messageId: updated.id });
  }
}
