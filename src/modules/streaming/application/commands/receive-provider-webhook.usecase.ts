import { Injectable, Inject } from '@nestjs/common';
import { WebhookEventService } from '../../../../platform/webhooks/webhook-event.service';
import {
  STREAM_SESSION_REPOSITORY,
  StreamSessionRepositoryPort,
} from '../../domain/ports/stream-session.repository.port';
import { SessionStatsFinalizer } from '../session-stats-finalizer.service';

// LiveKit's own webhook event names (https://docs.livekit.io/home/server/webhooks/). Only
// `room_finished` drives a state change here — `room_started` is a no-op because our own
// start-session use case already marks the session LIVE synchronously; this webhook is a
// confirmation signal, not the trigger. See 06-REALTIME-AND-CONCURRENCY.md §11: the real job of
// this handler is catching a stream that ended without our `/streams/:id/end` being called
// (seller's connection dropped, provider crashed, etc).
export type ProviderWebhookEventType = 'room_started' | 'room_finished';

export interface ReceiveProviderWebhookCommand {
  readonly provider: string;
  readonly providerEventId: string;
  readonly type: ProviderWebhookEventType;
  readonly providerRoomId: string;
  readonly payload: unknown;
}

export interface ReceiveProviderWebhookResult {
  readonly deduped: boolean;
}

@Injectable()
export class ReceiveProviderWebhookUseCase {
  constructor(
    private readonly webhookEvents: WebhookEventService,
    @Inject(STREAM_SESSION_REPOSITORY) private readonly sessions: StreamSessionRepositoryPort,
    private readonly statsFinalizer: SessionStatsFinalizer,
  ) {}

  async execute(cmd: ReceiveProviderWebhookCommand): Promise<ReceiveProviderWebhookResult> {
    const { id, isNew } = await this.webhookEvents.recordIfNew({
      provider: cmd.provider,
      providerEventId: cmd.providerEventId,
      type: cmd.type,
      payload: cmd.payload,
    });

    if (!isNew) {
      return { deduped: true };
    }

    try {
      if (cmd.type === 'room_finished') {
        const session = await this.sessions.findByProviderRoomId(cmd.providerRoomId);
        if (session) {
          // Idempotent by construction: endIfLive no-ops if the session isn't LIVE anymore
          // (already ended via /streams/:id/end, a prior webhook, or the reconcile job).
          const ended = await this.sessions.endIfLive(session.id, new Date());
          if (ended) {
            await this.statsFinalizer.finalize(ended.id);
          }
        }
      }
      await this.webhookEvents.markProcessed(id);
    } catch (err) {
      await this.webhookEvents.markProcessed(id, err instanceof Error ? err.message : String(err));
      throw err;
    }

    return { deduped: false };
  }
}
