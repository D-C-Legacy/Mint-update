import { Injectable, Inject } from '@nestjs/common';
import { CHAT_BAN_REPOSITORY, ChatBanRepositoryPort } from '../../domain/ports/chat-ban.repository.port';
import { ChatBanCacheService } from '../../infra/chat-ban-cache.service';

export interface UnbanUserCommand {
  readonly channelId: string;
  readonly userId: string;
}

@Injectable()
export class UnbanUserUseCase {
  constructor(
    @Inject(CHAT_BAN_REPOSITORY) private readonly bans: ChatBanRepositoryPort,
    private readonly banCache: ChatBanCacheService,
  ) {}

  async execute(cmd: UnbanUserCommand): Promise<void> {
    await this.bans.delete(cmd.channelId, cmd.userId);
    await this.banCache.clearBan(cmd.channelId, cmd.userId);
  }
}
