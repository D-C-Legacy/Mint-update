import { Injectable, Inject } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { CHAT_BAN_REPOSITORY, ChatBanRepositoryPort } from '../../domain/ports/chat-ban.repository.port';
import { ChatBanCacheService } from '../../infra/chat-ban-cache.service';

export interface BanUserCommand {
  readonly channelId: string;
  readonly userId: string;
  readonly bannedByUserId: string;
  readonly reason: string | null;
  readonly expiresAt: Date | null;
}

// No HTTP route anywhere owns creating a ChatBan — 05-API-SPEC.md only documents deleting a
// message, never banning a user, and no ticket in 07-IMPLEMENTATION-PLAN.md builds one either.
// P4-06's own deliverable is "ban check" (the read path chat.send uses), which is dead code
// without some way to actually create a ban — built this (and UnbanUserUseCase) as the minimal
// write path so the mechanism is real and testable, flagged here rather than silently assumed
// complete. Writes Postgres (source of truth, e.g. for a future admin UI) and the Redis cache
// together so the "refreshed on ban changes" half of 06-REALTIME-AND-CONCURRENCY.md §9 is honored
// — nothing currently calls this from outside the module.
@Injectable()
export class BanUserUseCase {
  constructor(
    @Inject(CHAT_BAN_REPOSITORY) private readonly bans: ChatBanRepositoryPort,
    private readonly banCache: ChatBanCacheService,
  ) {}

  async execute(cmd: BanUserCommand): Promise<void> {
    await this.bans.upsert({
      id: generateId(),
      channelId: cmd.channelId,
      userId: cmd.userId,
      bannedByUserId: cmd.bannedByUserId,
      reason: cmd.reason,
      expiresAt: cmd.expiresAt,
    });
    await this.banCache.setBan(cmd.channelId, cmd.userId, cmd.expiresAt);
  }
}
