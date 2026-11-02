import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import {
  InvalidSellerStatusError,
  SellerApplicationNotFoundError,
} from '../../domain/errors/sellers.errors';
import { SellerStatus } from '../../domain/entities/seller.entity';

export interface SubmitApplicationCommand {
  readonly userId: string;
}

export interface SubmitApplicationResult {
  readonly status: SellerStatus;
}

@Injectable()
export class SubmitApplicationUseCase {
  constructor(@Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort) {}

  async execute(
    cmd: SubmitApplicationCommand,
  ): Promise<Result<SubmitApplicationResult, SellerApplicationNotFoundError | InvalidSellerStatusError>> {
    const seller = await this.sellers.findByUserId(cmd.userId);
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`user ${cmd.userId}`));
    }
    if (seller.status !== 'DRAFT') {
      return Err(new InvalidSellerStatusError('submit the application', 'DRAFT', seller.status));
    }

    const updated = await this.sellers.submit(seller.id, new Date());
    return Ok({ status: updated.status });
  }
}
