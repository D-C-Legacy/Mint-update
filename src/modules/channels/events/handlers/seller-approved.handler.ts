import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  SELLER_APPROVED_EVENT,
  SellerApprovedPayload,
} from '../../../sellers/events/published/seller-approved.event';
import { CreateChannelUseCase } from '../../application/commands/create-channel.usecase';

// Why a channel gets created here rather than inside ApproveApplicationUseCase: channels didn't
// exist when P2-05 landed approve. This handler is the intended consumer of the seller.approved
// event, not a workaround — see MEMORY.md. createIfMissing makes this safe under redelivery.
@Injectable()
export class SellerApprovedHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly createChannelUseCase: CreateChannelUseCase,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<SellerApprovedPayload>(SELLER_APPROVED_EVENT, async (event) => {
      await this.createChannelUseCase.execute({
        sellerId: event.payload.sellerId,
        name: event.payload.displayName,
      });
    });
  }
}
