import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import { SellerApplicationNotFoundError } from '../../domain/errors/sellers.errors';

export interface UpdateCommissionCommand {
  readonly sellerId: string;
  readonly commissionBps: number;
}

export interface UpdateCommissionResult {
  readonly sellerId: string;
  readonly commissionBps: number;
}

// `PATCH /admin/sellers/:id/commission` (05-API-SPEC.md §11) — unowned by any ticket since P2-06
// flagged it. `:id` is the Seller.id directly (admin acts on the seller record itself, not via a
// userId lookup like the self-service profile routes).
@Injectable()
export class UpdateCommissionUseCase {
  constructor(@Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort) {}

  async execute(cmd: UpdateCommissionCommand): Promise<Result<UpdateCommissionResult, SellerApplicationNotFoundError>> {
    const seller = await this.sellers.findById(cmd.sellerId);
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`seller ${cmd.sellerId}`));
    }

    const updated = await this.sellers.updateCommission(cmd.sellerId, { commissionBps: cmd.commissionBps });
    return Ok({ sellerId: updated.id, commissionBps: updated.commissionBps });
  }
}
