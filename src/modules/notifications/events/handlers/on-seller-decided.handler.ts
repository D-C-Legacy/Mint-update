import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  SELLER_APPROVED_EVENT,
  SellerApprovedPayload,
} from '../../../sellers/events/published/seller-approved.event';
import {
  SELLER_REJECTED_EVENT,
  SellerRejectedPayload,
} from '../../../sellers/events/published/seller-rejected.event';
import { TemplateRegistry } from '../../application/template-registry.service';
import { UserNotificationDispatcher } from './user-notification-dispatcher.service';

const APPROVED_TEMPLATE_KEY = 'seller.application.approved';
const REJECTED_TEMPLATE_KEY = 'seller.application.rejected';

// "application decided" (07-IMPLEMENTATION-PLAN.md's P8-04 deliverable) covers both outcomes —
// one handler, two subscriptions. `seller.approved` already existed (channels' own
// SellerApprovedHandler also subscribes to it, for a different purpose — multiple handlers per
// event name is supported); `seller.rejected` is new in this same ticket (RejectApplicationUseCase
// never published anything before).
@Injectable()
export class OnSellerDecidedHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly templates: TemplateRegistry,
    private readonly dispatcher: UserNotificationDispatcher,
  ) {
    this.templates.register({
      key: APPROVED_TEMPLATE_KEY,
      channel: 'PUSH',
      render: () => ({
        title: 'Application approved',
        body: "You're approved to sell. Start setting up your channel.",
      }),
    });
    this.templates.register({
      key: APPROVED_TEMPLATE_KEY,
      channel: 'EMAIL',
      render: () => ({
        subject: 'Your seller application was approved',
        body: "Congratulations, you're approved to sell. You can now set up your channel and list products.",
      }),
    });
    this.templates.register({
      key: REJECTED_TEMPLATE_KEY,
      channel: 'PUSH',
      render: () => ({
        title: 'Application not approved',
        body: 'Your seller application was not approved.',
      }),
    });
    this.templates.register({
      key: REJECTED_TEMPLATE_KEY,
      channel: 'EMAIL',
      render: (data) => ({
        subject: 'Your seller application was not approved',
        body: `Your seller application was not approved. Reason: ${data.reason as string}`,
      }),
    });
  }

  onModuleInit(): void {
    this.eventBus.subscribe<SellerApprovedPayload>(SELLER_APPROVED_EVENT, async (event) => {
      await this.dispatcher.dispatch(event.payload.userId, APPROVED_TEMPLATE_KEY, {
        sellerId: event.payload.sellerId,
        ref: { type: 'message', id: event.payload.userId },
      });
    });

    this.eventBus.subscribe<SellerRejectedPayload>(SELLER_REJECTED_EVENT, async (event) => {
      await this.dispatcher.dispatch(event.payload.userId, REJECTED_TEMPLATE_KEY, {
        sellerId: event.payload.sellerId,
        reason: event.payload.reason,
        ref: { type: 'message', id: event.payload.userId },
      });
    });
  }
}
