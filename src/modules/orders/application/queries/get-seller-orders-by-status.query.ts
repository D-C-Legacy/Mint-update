import { Inject, Injectable } from '@nestjs/common';
import {
  SELLER_ANALYTICS_REPOSITORY,
  SellerAnalyticsRepositoryPort,
} from '../../domain/ports/seller-analytics.repository.port';
import { SellerStatusCount } from '../../domain/entities/seller-analytics.entity';
import { SellersService } from '../../../sellers/application/sellers.service';

export interface GetSellerOrdersByStatusCommand {
  readonly sellerUserId: string;
}

@Injectable()
export class GetSellerOrdersByStatusQuery {
  constructor(
    @Inject(SELLER_ANALYTICS_REPOSITORY) private readonly analytics: SellerAnalyticsRepositoryPort,
    private readonly sellers: SellersService,
  ) {}

  async execute(cmd: GetSellerOrdersByStatusCommand): Promise<readonly SellerStatusCount[]> {
    const seller = await this.sellers.getMySeller({ userId: cmd.sellerUserId });
    if (!seller.ok) {
      return [];
    }
    return this.analytics.ordersByStatus(seller.value.seller.id);
  }
}
