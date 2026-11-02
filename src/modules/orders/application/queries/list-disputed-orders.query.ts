import { Inject, Injectable } from '@nestjs/common';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { Order } from '../../domain/entities/order.entity';

export interface ListDisputedOrdersCommand {
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// Added for P8-05's "disputed orders" admin queue (07-IMPLEMENTATION-PLAN.md). Locked to
// DISPUTED specifically — `GET /admin/orders`'s broader "all orders, filterable"
// (05-API-SPEC.md §11) stays unowned, same gap flagged since P6-06/07/08, not silently solved
// here as a side effect of this one.
@Injectable()
export class ListDisputedOrdersQuery {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort) {}

  async execute(cmd: ListDisputedOrdersCommand): Promise<CursorPage<Order>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.orders.findByStatus({ status: 'DISPUTED', cursor: cmd.cursor, limit });
    return buildCursorPage(rows, limit);
  }
}
