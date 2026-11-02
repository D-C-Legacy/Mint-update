import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import {
  InvalidSellerStatusError,
  SellerApplicationNotFoundError,
} from '../../domain/errors/sellers.errors';
import { transitionSellerStatus } from '../../domain/rules/seller-status-transition.rule';
import { SellerStatus } from '../../domain/entities/seller.entity';
import { sellerRejectedEvent } from '../../events/published/seller-rejected.event';

export interface RejectApplicationCommand {
  readonly applicationId: string;
  readonly reviewedByUserId: string;
  readonly reason: string;
}

export interface RejectApplicationResult {
  readonly sellerId: string;
  readonly status: SellerStatus;
}

@Injectable()
export class RejectApplicationUseCase {
  constructor(
    @Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(
    cmd: RejectApplicationCommand,
  ): Promise<Result<RejectApplicationResult, SellerApplicationNotFoundError | InvalidSellerStatusError>> {
    const seller = await this.sellers.findByApplicationId(cmd.applicationId);
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`application ${cmd.applicationId}`));
    }

    const transition = transitionSellerStatus('REJECT', seller.status);
    if (!transition.ok) {
      return Err(transition.error);
    }

    const updated = await this.sellers.reject(seller.id, cmd.reviewedByUserId, new Date(), cmd.reason);

    await this.eventBus.publish(
      sellerRejectedEvent({
        sellerId: updated.id,
        userId: updated.userId,
        displayName: updated.displayName,
        reason: cmd.reason,
      }),
    );

    return Ok({ sellerId: updated.id, status: updated.status });
  }
}
