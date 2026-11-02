import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { SellersService } from '../../../sellers/application/sellers.service';
import { ChannelsService } from '../../../channels/application/channels.service';
import { streamStartedEvent } from '../../events/published/stream-started.event';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../../domain/ports/stream-session.repository.port';
import {
  PublisherAccess,
  STREAM_PROVIDER,
  StreamProviderPort,
} from '../../domain/ports/stream-provider.port';
import { transitionStreamStatus } from '../../domain/rules/stream-status-transition.rule';
import {
  ChannelNotFoundError,
  InvalidStreamStatusError,
  SellerNotApprovedError,
  SellerProfileNotFoundError,
  StreamSessionNotFoundError,
} from '../../domain/errors/streaming.errors';
import { StreamSession } from '../../domain/entities/stream-session.entity';

export interface StartSessionCommand {
  readonly userId: string;
  readonly sessionId: string;
}

export interface StartSessionResult {
  readonly session: StreamSession;
  readonly publisherAccess: PublisherAccess;
  readonly providerRoomId: string;
}

@Injectable()
export class StartSessionUseCase {
  constructor(
    private readonly sellers: SellersService,
    private readonly channels: ChannelsService,
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    @Inject(STREAM_PROVIDER) private readonly provider: StreamProviderPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(
    cmd: StartSessionCommand,
  ): Promise<
    Result<
      StartSessionResult,
      | StreamSessionNotFoundError
      | SellerProfileNotFoundError
      | SellerNotApprovedError
      | ChannelNotFoundError
      | InvalidStreamStatusError
    >
  > {
    const session = await this.sessions.findById(cmd.sessionId);
    if (!session) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    const sellerResult = await this.sellers.getMySeller({ userId: cmd.userId });
    if (!sellerResult.ok) {
      return Err(new SellerProfileNotFoundError(cmd.userId));
    }
    if (sellerResult.value.seller.status !== 'APPROVED') {
      return Err(new SellerNotApprovedError());
    }

    // 404, not 403, on a mismatch — same "don't leak existence of someone else's resource"
    // precedent as catalog's product ownership check.
    const channelResult = await this.channels.getMyChannel({ userId: cmd.userId });
    if (!channelResult.ok || channelResult.value.channel.id !== session.channelId) {
      return Err(new StreamSessionNotFoundError(cmd.sessionId));
    }

    const transition = transitionStreamStatus('START', session.status);
    if (!transition.ok) {
      return Err(transition.error);
    }

    const { providerRoomId } = await this.provider.createRoom({ sessionId: session.id });
    const publisherAccess = await this.provider.publishToken({
      providerRoomId,
      userId: cmd.userId,
      displayName: sellerResult.value.seller.displayName,
    });

    const updated = await this.sessions.start(session.id, {
      providerRoomId,
      startedAt: new Date(),
    });

    await this.eventBus.publish(
      streamStartedEvent({
        sessionId: updated.id,
        channelId: updated.channelId,
        sellerId: sellerResult.value.seller.id,
        title: updated.title,
      }),
    );

    return Ok({ session: updated, publisherAccess, providerRoomId });
  }
}
