import { Inject, Injectable } from '@nestjs/common';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import { Seller } from '../../domain/entities/seller.entity';

export interface GetSellerByIdCommand {
  readonly sellerId: string;
}

// Added for P5-09: the sales gateway needs to resolve Sale.sellerId (a Seller.id) to the
// seller's own User.id, to target their `user:{userId}` socket channel for `offer.received`.
// No other ticket needed this direction before (every prior lookup went userId -> Seller.id
// via getMySeller) — `findById` already existed on the repository, just never exposed.
@Injectable()
export class GetSellerByIdQuery {
  constructor(@Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort) {}

  async execute(cmd: GetSellerByIdCommand): Promise<Seller | null> {
    return this.sellers.findById(cmd.sellerId);
  }
}
