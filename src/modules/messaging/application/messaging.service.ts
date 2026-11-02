import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../shared/result/result';
import { CursorPage } from '../../../shared/pagination/cursor';
import { StartConversationUseCase, StartConversationCommand } from './commands/start-conversation.usecase';
import { SendMessageUseCase, SendMessageCommand } from './commands/send-message.usecase';
import { MarkConversationReadUseCase, MarkConversationReadCommand } from './commands/mark-conversation-read.usecase';
import { ListMyConversationsQuery, ListMyConversationsCommand } from './queries/list-my-conversations.query';
import { ListMessagesQuery, ListMessagesCommand } from './queries/list-messages.query';
import { Conversation } from '../domain/entities/conversation.entity';
import { Message } from '../domain/entities/message.entity';
import {
  ConversationNotFoundError,
  MessageNotFoundError,
  SellerCannotMessageSelfError,
} from '../domain/errors/messaging.errors';
import { SellerApplicationNotFoundError } from '../../sellers/domain/errors/sellers.errors';
import { MESSAGING_REPOSITORY, MessagingRepositoryPort } from '../domain/ports/messaging.repository.port';

@Injectable()
export class MessagingService {
  constructor(
    private readonly startConversationUseCase: StartConversationUseCase,
    private readonly sendMessageUseCase: SendMessageUseCase,
    private readonly markConversationReadUseCase: MarkConversationReadUseCase,
    private readonly listMyConversationsQuery: ListMyConversationsQuery,
    private readonly listMessagesQuery: ListMessagesQuery,
    @Inject(MESSAGING_REPOSITORY) private readonly messaging: MessagingRepositoryPort,
  ) {}

  async startConversation(
    cmd: StartConversationCommand,
  ): Promise<Result<Conversation, SellerApplicationNotFoundError | SellerCannotMessageSelfError>> {
    return this.startConversationUseCase.execute(cmd);
  }

  async sendMessage(cmd: SendMessageCommand): Promise<Result<Message, ConversationNotFoundError>> {
    return this.sendMessageUseCase.execute(cmd);
  }

  async markRead(cmd: MarkConversationReadCommand): Promise<Result<Conversation, ConversationNotFoundError>> {
    return this.markConversationReadUseCase.execute(cmd);
  }

  async listMyConversations(cmd: ListMyConversationsCommand): Promise<CursorPage<Conversation>> {
    return this.listMyConversationsQuery.execute(cmd);
  }

  async listMessages(cmd: ListMessagesCommand): Promise<Result<CursorPage<Message>, ConversationNotFoundError>> {
    return this.listMessagesQuery.execute(cmd);
  }

  // --- Admin moderation support (AdminController, same shape as ChatService.deleteMessage) ---

  // A real hard delete (not a soft hide like reviews): a harmful DM shouldn't stay visible to the
  // recipient either. Mirrors the existing chat/messages/:id/delete precedent exactly.
  async adminDeleteMessage(messageId: string): Promise<Result<true, MessageNotFoundError>> {
    const deleted = await this.messaging.deleteMessage(messageId);
    if (!deleted) {
      return Err(new MessageNotFoundError(messageId));
    }
    return Ok(true);
  }

  // Thin lookup for ReportsService's admin preview enrichment.
  async adminFindMessageById(messageId: string): Promise<Message | null> {
    return this.messaging.findMessageById(messageId);
  }
}
