import { Injectable } from '@nestjs/common';
import { Result } from '../../../shared/result/result';
import {
  SendMessageUseCase,
  SendMessageCommand,
  SendMessageResult,
} from './commands/send-message.usecase';
import {
  DeleteMessageUseCase,
  DeleteMessageCommand,
  DeleteMessageResult,
} from './commands/delete-message.usecase';
import { BanUserUseCase, BanUserCommand } from './commands/ban-user.usecase';
import { UnbanUserUseCase, UnbanUserCommand } from './commands/unban-user.usecase';
import { ChatCacheService, ChatMessageSnapshot } from '../infra/chat-cache.service';
import {
  ChatMessageNotFoundError,
  ChatRateLimitedError,
  StreamNotLiveError,
  StreamSessionNotFoundError,
  UserBannedError,
} from '../domain/errors/chat.errors';

@Injectable()
export class ChatService {
  constructor(
    private readonly sendMessageUseCase: SendMessageUseCase,
    private readonly deleteMessageUseCase: DeleteMessageUseCase,
    private readonly banUserUseCase: BanUserUseCase,
    private readonly unbanUserUseCase: UnbanUserUseCase,
    private readonly cache: ChatCacheService,
  ) {}

  async sendMessage(
    cmd: SendMessageCommand,
  ): Promise<
    Result<
      SendMessageResult,
      StreamSessionNotFoundError | StreamNotLiveError | UserBannedError | ChatRateLimitedError
    >
  > {
    return this.sendMessageUseCase.execute(cmd);
  }

  // Recent chat history for a session, read from the capped Redis list. This is what room.state
  // carries so a joiner sees the last few messages immediately; it is a cache, not the source of
  // truth (Postgres is), and a thinner-than-usual snapshot is acceptable (06-...§9).
  async getRecentMessages(sessionId: string): Promise<ChatMessageSnapshot[]> {
    return this.cache.getRecentMessages(sessionId);
  }

  async deleteMessage(
    cmd: DeleteMessageCommand,
  ): Promise<Result<DeleteMessageResult, ChatMessageNotFoundError>> {
    return this.deleteMessageUseCase.execute(cmd);
  }

  async banUser(cmd: BanUserCommand): Promise<void> {
    return this.banUserUseCase.execute(cmd);
  }

  async unbanUser(cmd: UnbanUserCommand): Promise<void> {
    return this.unbanUserUseCase.execute(cmd);
  }
}
