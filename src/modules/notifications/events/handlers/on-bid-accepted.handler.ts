import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  BID_ACCEPTED_EVENT,
  BidAcceptedPayload,
} from '../../../sales/events/published/bid-accepted.event';
import { TemplateRegistry } from '../../application/template-registry.service';
import { UserNotificationDispatcher } from './user-notification-dispatcher.service';
import { formatUsdMinorUnits } from './format-usd.util';

const TEMPLATE_KEY = 'sale.bid-outbid';

// "outbid" (07-IMPLEMENTATION-PLAN.md's P8-04 deliverable) — bid-accepted.event.ts already
// carries `previousLeaderUserId` specifically for this (see its own doc comment), so this is the
// one handler in this ticket needing no new published-event work.
@Injectable()
export class OnBidAcceptedHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly templates: TemplateRegistry,
    private readonly dispatcher: UserNotificationDispatcher,
  ) {
    this.templates.register({
      key: TEMPLATE_KEY,
      channel: 'PUSH',
      render: (data) => ({
        title: 'Outbid!',
        body: `Someone placed a higher bid of ${formatUsdMinorUnits(data.amount as string)}.`,
      }),
    });
    this.templates.register({
      key: TEMPLATE_KEY,
      channel: 'EMAIL',
      render: (data) => ({
        subject: "You've been outbid",
        body: `Someone placed a higher bid of ${formatUsdMinorUnits(data.amount as string)}. Place a new bid before the auction ends.`,
      }),
    });
  }

  onModuleInit(): void {
    // Gated by the user's "bids" Settings toggle (UserNotificationDispatcher).
    this.eventBus.subscribe<BidAcceptedPayload>(BID_ACCEPTED_EVENT, async (event) => {
      if (!event.payload.previousLeaderUserId) {
        return;
      }
      await this.dispatcher.dispatch(
        event.payload.previousLeaderUserId,
        TEMPLATE_KEY,
        {
          amount: event.payload.amount,
          saleId: event.payload.saleId,
          ref: { type: 'sale', id: event.payload.saleId },
        },
        'BIDS',
      );
    });
  }
}
