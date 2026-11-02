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
import { sellerApprovedEvent } from '../../events/published/seller-approved.event';

export interface ApproveApplicationCommand {
  readonly applicationId: string;
  readonly reviewedByUserId: string;
}

export interface ApproveApplicationResult {
  readonly sellerId: string;
  readonly status: SellerStatus;
}

@Injectable()
export class ApproveApplicationUseCase {
  constructor(
    @Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async execute(
    cmd: ApproveApplicationCommand,
  ): Promise<Result<ApproveApplicationResult, SellerApplicationNotFoundError | InvalidSellerStatusError>> {
    const seller = await this.sellers.findByApplicationId(cmd.applicationId);
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`application ${cmd.applicationId}`));
    }

    const transition = transitionSellerStatus('APPROVE', seller.status);
    if (!transition.ok) {
      return Err(transition.error);
    }

    const updated = await this.sellers.approve(seller.id, cmd.reviewedByUserId, new Date());

    await this.eventBus.publish(
      sellerApprovedEvent({ sellerId: updated.id, userId: updated.userId, displayName: updated.displayName }),
    );

    return Ok({ sellerId: updated.id, status: updated.status });
  }
}
