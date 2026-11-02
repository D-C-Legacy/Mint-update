import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import { SellerApplicationNotFoundError } from '../../domain/errors/sellers.errors';

export interface UpdateProfileCommand {
  readonly userId: string;
  readonly displayName: string;
}

export interface UpdateProfileResult {
  readonly sellerId: string;
  readonly displayName: string;
}

@Injectable()
export class UpdateProfileUseCase {
  constructor(@Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort) {}

  async execute(cmd: UpdateProfileCommand): Promise<Result<UpdateProfileResult, SellerApplicationNotFoundError>> {
    const seller = await this.sellers.findByUserId(cmd.userId);
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`user ${cmd.userId}`));
    }

    const updated = await this.sellers.updateProfile(seller.id, { displayName: cmd.displayName });
    return Ok({ sellerId: updated.id, displayName: updated.displayName });
  }
}
