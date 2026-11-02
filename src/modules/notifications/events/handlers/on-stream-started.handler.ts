import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  STREAM_STARTED_EVENT,
  StreamStartedPayload,
} from '../../../streaming/events/published/stream-started.event';
import { ChannelsService } from '../../../channels/application/channels.service';
import { TemplateRegistry } from '../../application/template-registry.service';
import { UserNotificationDispatcher } from './user-notification-dispatcher.service';

const TEMPLATE_KEY = 'stream.started';

// "channel went live" (07-IMPLEMENTATION-PLAN.md's P8-04 deliverable) — the one handler of the 6
// that fans out to many recipients (every follower) rather than one. `stream.started` is a new
// event added in this same ticket (StartSessionUseCase never published anything before).
@Injectable()
export class OnStreamStartedHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly channels: ChannelsService,
    private readonly templates: TemplateRegistry,
    private readonly dispatcher: UserNotificationDispatcher,
  ) {
    this.templates.register({
      key: TEMPLATE_KEY,
      channel: 'PUSH',
      render: (data) => ({
        title: 'Live now',
        body: `${data.title as string} just went live.`,
      }),
    });
    this.templates.register({
      key: TEMPLATE_KEY,
      channel: 'EMAIL',
      render: (data) => ({
        subject: 'A channel you follow just went live',
        body: `${data.title as string} just went live. Watch now before it ends.`,
      }),
    });
  }

  onModuleInit(): void {
    // Gated by the user's "live" Settings toggle (UserNotificationDispatcher).
    this.eventBus.subscribe<StreamStartedPayload>(STREAM_STARTED_EVENT, async (event) => {
      const followerUserIds = await this.channels.listFollowerUserIds({
        channelId: event.payload.channelId,
      });
      await Promise.all(
        followerUserIds.map((userId) =>
          this.dispatcher.dispatch(
            userId,
            TEMPLATE_KEY,
            {
              title: event.payload.title,
              sessionId: event.payload.sessionId,
              ref: { type: 'stream', id: event.payload.sessionId },
            },
            'LIVE',
          ),
        ),
      );
    });
  }
}
