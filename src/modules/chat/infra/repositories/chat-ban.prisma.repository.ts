import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import { ChatBanRepositoryPort, UpsertChatBanInput } from '../../domain/ports/chat-ban.repository.port';

@Injectable()
export class ChatBanPrismaRepository implements ChatBanRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: UpsertChatBanInput): Promise<void> {
    await this.prisma.chatBan.upsert({
      where: { channelId_userId: { channelId: input.channelId, userId: input.userId } },
      create: {
        id: input.id,
        channelId: input.channelId,
        userId: input.userId,
        bannedByUserId: input.bannedByUserId,
        reason: input.reason,
        expiresAt: input.expiresAt,
      },
      update: {
        bannedByUserId: input.bannedByUserId,
        reason: input.reason,
        expiresAt: input.expiresAt,
      },
    });
  }

  async delete(channelId: string, userId: string): Promise<void> {
    await this.prisma.chatBan.deleteMany({ where: { channelId, userId } });
  }
}
