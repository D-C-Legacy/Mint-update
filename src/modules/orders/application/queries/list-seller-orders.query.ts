import { Inject, Injectable } from '@nestjs/common';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { Order, OrderStatus } from '../../domain/entities/order.entity';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { SellersService } from '../../../sellers/application/sellers.service';

export interface ListSellerOrdersCommand {
  readonly sellerUserId: string;
  readonly status: OrderStatus | undefined;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// The seller's order queue (GET /v1/seller/orders, 05-API-SPEC.md §8). A caller with no approved
// seller profile gets an empty page, not an error — same as a buyer with no orders.
@Injectable()
export class ListSellerOrdersQuery {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    private readonly sellers: SellersService,
  ) {}

  async execute(cmd: ListSellerOrdersCommand): Promise<CursorPage<Order>> {
    const limit = normalizeLimit(cmd.limit);
    const seller = await this.sellers.getMySeller({ userId: cmd.sellerUserId });
    if (!seller.ok) {
      return buildCursorPage([], limit);
    }
    const rows = await this.orders.findBySeller({
      sellerId: seller.value.seller.id,
      status: cmd.status,
      cursor: cmd.cursor,
      limit,
    });
    return buildCursorPage(rows, limit);
  }
}
