import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import {
  InvalidSellerStatusError,
  SellerApplicationNotFoundError,
} from '../../domain/errors/sellers.errors';
import { transitionSellerStatus } from '../../domain/rules/seller-status-transition.rule';
import { SellerStatus } from '../../domain/entities/seller.entity';

export interface SuspendSellerCommand {
  readonly sellerId: string;
}

export interface SuspendSellerResult {
  readonly sellerId: string;
  readonly status: SellerStatus;
}

@Injectable()
export class SuspendSellerUseCase {
  constructor(@Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort) {}

  async execute(
    cmd: SuspendSellerCommand,
  ): Promise<Result<SuspendSellerResult, SellerApplicationNotFoundError | InvalidSellerStatusError>> {
    const seller = await this.sellers.findById(cmd.sellerId);
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`seller ${cmd.sellerId}`));
    }

    const transition = transitionSellerStatus('SUSPEND', seller.status);
    if (!transition.ok) {
      return Err(transition.error);
    }

    const updated = await this.sellers.suspend(seller.id, new Date());
    return Ok({ sellerId: updated.id, status: updated.status });
  }
}
