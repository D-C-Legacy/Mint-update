import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import {
  InvalidSellerStatusError,
  SellerApplicationNotFoundError,
} from '../../domain/errors/sellers.errors';
import { SellerStatus } from '../../domain/entities/seller.entity';

export interface WithdrawApplicationCommand {
  readonly userId: string;
}

export interface WithdrawApplicationResult {
  readonly status: SellerStatus;
}

@Injectable()
export class WithdrawApplicationUseCase {
  constructor(@Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort) {}

  async execute(
    cmd: WithdrawApplicationCommand,
  ): Promise<Result<WithdrawApplicationResult, SellerApplicationNotFoundError | InvalidSellerStatusError>> {
    const seller = await this.sellers.findByUserId(cmd.userId);
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`user ${cmd.userId}`));
    }
    if (seller.status !== 'PENDING_REVIEW') {
      return Err(new InvalidSellerStatusError('withdraw the application', 'PENDING_REVIEW', seller.status));
    }

    const updated = await this.sellers.withdraw(seller.id);
    return Ok({ status: updated.status });
  }
}
