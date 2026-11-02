import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import { SellerApplicationNotFoundError } from '../../domain/errors/sellers.errors';
import { Seller } from '../../domain/entities/seller.entity';

export interface GetMySellerCommand {
  readonly userId: string;
}

export interface GetMySellerResult {
  readonly seller: Seller;
}

@Injectable()
export class GetMySellerQuery {
  constructor(@Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort) {}

  async execute(cmd: GetMySellerCommand): Promise<Result<GetMySellerResult, SellerApplicationNotFoundError>> {
    const seller = await this.sellers.findByUserId(cmd.userId);
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`user ${cmd.userId}`));
    }
    return Ok({ seller });
  }
}
