import { Inject, Injectable } from '@nestjs/common';
import { CursorPage, buildCursorPage, normalizeLimit } from '../../../../shared/pagination/cursor';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../domain/ports/order.repository.port';
import { Order, OrderStatus } from '../../domain/entities/order.entity';

export interface ListOrdersCommand {
  readonly status: OrderStatus | undefined;
  readonly cursor: string | undefined;
  readonly limit: number | undefined;
}

// `GET /admin/orders` (05-API-SPEC.md §11, "All orders, filterable") — unowned since
// P6-06/07/08. Reuses the same `findByStatus` port method as P8-05's DISPUTED-locked dashboard,
// just with an optional status instead of a hardcoded one.
@Injectable()
export class ListOrdersQuery {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort) {}

  async execute(cmd: ListOrdersCommand): Promise<CursorPage<Order>> {
    const limit = normalizeLimit(cmd.limit);
    const rows = await this.orders.findByStatus({ status: cmd.status, cursor: cmd.cursor, limit });
    return buildCursorPage(rows, limit);
  }
}
