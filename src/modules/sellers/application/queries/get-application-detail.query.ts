import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import { SellerApplicationNotFoundError } from '../../domain/errors/sellers.errors';
import { SellerApplicationDetail } from '../../domain/entities/seller-application-summary.entity';

export interface GetApplicationDetailCommand {
  readonly applicationId: string;
}

@Injectable()
export class GetApplicationDetailQuery {
  constructor(@Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort) {}

  async execute(
    cmd: GetApplicationDetailCommand,
  ): Promise<Result<SellerApplicationDetail, SellerApplicationNotFoundError>> {
    const detail = await this.sellers.getApplicationDetail(cmd.applicationId);
    if (!detail) {
      return Err(new SellerApplicationNotFoundError(`application ${cmd.applicationId}`));
    }
    return Ok(detail);
  }
}
