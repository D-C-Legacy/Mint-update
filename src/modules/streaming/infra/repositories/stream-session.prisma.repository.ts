import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateStreamSessionInput,
  ListLiveStreamSessionsInput,
  StartStreamSessionInput,
  StreamSessionRepositoryPort,
  UpdateSessionStatsInput,
} from '../../domain/ports/stream-session.repository.port';
import { StreamSession } from '../../domain/entities/stream-session.entity';
import { toDomainStreamSession } from '../mappers/stream-session.mapper';

@Injectable()
export class StreamSessionPrismaRepository implements StreamSessionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateStreamSessionInput): Promise<StreamSession> {
    const row = await this.prisma.streamSession.create({
      data: {
        id: input.id,
        channelId: input.channelId,
        title: input.title,
        scheduledFor: input.scheduledFor,
      },
    });
    return toDomainStreamSession(row);
  }

  async findById(id: string): Promise<StreamSession | null> {
    const row = await this.prisma.streamSession.findUnique({ where: { id } });
    return row ? toDomainStreamSession(row) : null;
  }

  async findByProviderRoomId(providerRoomId: string): Promise<StreamSession | null> {
    const row = await this.prisma.streamSession.findUnique({ where: { providerRoomId } });
    return row ? toDomainStreamSession(row) : null;
  }

  async findAllLive(): Promise<StreamSession[]> {
    const rows = await this.prisma.streamSession.findMany({ where: { status: 'LIVE' } });
    return rows.map(toDomainStreamSession);
  }

  async listLive(input: ListLiveStreamSessionsInput): Promise<StreamSession[]> {
    const rows = await this.prisma.streamSession.findMany({
      where: { status: 'LIVE' },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomainStreamSession);
  }

  async start(id: string, input: StartStreamSessionInput): Promise<StreamSession> {
    const row = await this.prisma.streamSession.update({
      where: { id },
      data: { status: 'LIVE', providerRoomId: input.providerRoomId, startedAt: input.startedAt },
    });
    return toDomainStreamSession(row);
  }

  async end(id: string, endedAt: Date): Promise<StreamSession> {
    const row = await this.prisma.streamSession.update({
      where: { id },
      data: { status: 'ENDED', endedAt },
    });
    return toDomainStreamSession(row);
  }

  async endIfLive(id: string, endedAt: Date): Promise<StreamSession | null> {
    const { count } = await this.prisma.streamSession.updateMany({
      where: { id, status: 'LIVE' },
      data: { status: 'ENDED', endedAt },
    });
    if (count === 0) {
      return null;
    }
    return this.findById(id);
  }

  // No separate `cancelledAt` column exists (schema has only `endedAt`) — reused here as "when
  // did this stream stop," same meaning whichever way it stopped. Not a new migration since the
  // field is already nullable and unused for a SCHEDULED-origin kill.
  async cancel(id: string, cancelledAt: Date): Promise<StreamSession> {
    const row = await this.prisma.streamSession.update({
      where: { id },
      data: { status: 'CANCELLED', endedAt: cancelledAt },
    });
    return toDomainStreamSession(row);
  }

  async updateStats(id: string, stats: UpdateSessionStatsInput): Promise<void> {
    await this.prisma.streamSession.update({
      where: { id },
      data: {
        peakViewers: stats.peakViewers,
        itemsSold: stats.itemsSold,
        grossAmount: stats.grossAmount,
      },
    });
  }

  async setAutoQueueEnabled(id: string, enabled: boolean): Promise<StreamSession> {
    const row = await this.prisma.streamSession.update({
      where: { id },
      data: { autoQueueEnabled: enabled },
    });
    return toDomainStreamSession(row);
  }

  async sumPeakViewersForSeller(
    sellerId: string,
    range: { from: Date; to: Date },
  ): Promise<number> {
    const result = await this.prisma.streamSession.aggregate({
      where: { channel: { sellerId }, startedAt: { gte: range.from, lt: range.to } },
      _sum: { peakViewers: true },
    });
    return result._sum.peakViewers ?? 0;
  }
}
