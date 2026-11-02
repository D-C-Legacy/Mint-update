import { Inject, Injectable } from '@nestjs/common';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { Order } from '../../domain/entities/order.entity';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';

export interface ListMyOrdersCommand {
  readonly userId: string;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// The buyer's own orders (GET /v1/orders, 05-API-SPEC.md §8).
@Injectable()
export class ListMyOrdersQuery {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort) {}

  async execute(cmd: ListMyOrdersCommand): Promise<CursorPage<Order>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.orders.findByBuyer({ buyerUserId: cmd.userId, cursor: cmd.cursor, limit });
    return buildCursorPage(rows, limit);
  }
}
