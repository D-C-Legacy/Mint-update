import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  PAYOUT_SENT_EVENT,
  PayoutSentPayload,
} from '../../../payouts/events/published/payout-sent.event';
import { SellersService } from '../../../sellers/application/sellers.service';
import { TemplateRegistry } from '../../application/template-registry.service';
import { UserNotificationDispatcher } from './user-notification-dispatcher.service';
import { formatUsdMinorUnits } from './format-usd.util';

const TEMPLATE_KEY = 'payout.sent';

// "payout sent" (07-IMPLEMENTATION-PLAN.md's P8-04 deliverable) — `payout.sent` is a new domain
// event added in this same ticket (RunPayoutUseCase never published one before; the ledger's own
// `type: 'payout.sent'` transaction-type string is a different thing entirely, see that event's
// doc comment). `PayoutSentPayload.sellerId` is a Seller.id (established convention) — resolved
// to a User.id via SellersService.getSellerById, same pattern as P5-09's GetSellerByIdQuery.
// Note: PayoutsModule itself isn't wired into app.module.ts yet (no scheduler/HTTP trigger exists
// — see RunPayoutUseCase's own doc comment), so this event won't actually fire in the running app
// until whichever future ticket wires that in.
@Injectable()
export class OnPayoutSentHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly sellers: SellersService,
    private readonly templates: TemplateRegistry,
    private readonly dispatcher: UserNotificationDispatcher,
  ) {
    this.templates.register({
      key: TEMPLATE_KEY,
      channel: 'PUSH',
      render: (data) => ({
        title: 'Payout sent',
        body: `A payout of ${formatUsdMinorUnits(data.amount as string)} is on its way to you.`,
      }),
    });
    this.templates.register({
      key: TEMPLATE_KEY,
      channel: 'EMAIL',
      render: (data) => ({
        subject: 'Your payout has been sent',
        body: `A payout of ${formatUsdMinorUnits(data.amount as string)} has been sent to your account.`,
      }),
    });
  }

  onModuleInit(): void {
    this.eventBus.subscribe<PayoutSentPayload>(PAYOUT_SENT_EVENT, async (event) => {
      const seller = await this.sellers.getSellerById({ sellerId: event.payload.sellerId });
      if (!seller) {
        return;
      }
      await this.dispatcher.dispatch(seller.userId, TEMPLATE_KEY, {
        amount: event.payload.amount,
        currency: event.payload.currency,
        payoutId: event.payload.payoutId,
        ref: { type: 'message', id: event.payload.payoutId },
      });
    });
  }
}
