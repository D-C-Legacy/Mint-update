import { Injectable } from '@nestjs/common';
import { SellersService } from '../../sellers/application/sellers.service';
import { LedgerService } from '../../ledger/application/ledger.service';
import { OrdersService } from '../../orders/application/orders.service';

export interface CheckEligibilityCommand {
  readonly userId: string;
}

// A seller's order isn't "resolved" for this purpose until it's DELIVERED/COMPLETED/CANCELLED/
// REFUNDED — anything still PAID or SHIPPED means a buyer is waiting on them.
const UNRESOLVED_SELLER_ORDER_STATUSES = new Set(['PAID', 'SHIPPED']);

// Apple App Store guideline 5.1.1(v) account-deletion feature (28 Oct 2026, user-directed
// addition — no doc covers this). Lives in its own module rather than inside identity/sellers/
// orders/ledger: it needs read access to Sellers+Ledger+Orders, and IdentityModule can't import
// any of them without creating a module-import cycle (see request-account-deletion.usecase.ts).
// A buyer-only account (getMySeller erroring) has nothing to check. An active/scheduled live
// stream is deliberately NOT checked here — the founder asked for a client-side warning there,
// not a hard stop; only unpaid balance and unresolved orders actually block the request.
@Injectable()
export class AccountDeletionEligibilityService {
  constructor(
    private readonly sellers: SellersService,
    private readonly ledger: LedgerService,
    private readonly orders: OrdersService,
  ) {}

  async findSellerBlockers(cmd: CheckEligibilityCommand): Promise<string[]> {
    const seller = await this.sellers.getMySeller({ userId: cmd.userId });
    if (!seller.ok) {
      return [];
    }

    const reasons: string[] = [];

    const balance = await this.ledger.getBalanceForUser({ userId: cmd.userId });
    if (balance.ok && (balance.value.pendingAmount > 0n || balance.value.availableAmount > 0n)) {
      reasons.push('You have an unpaid payout balance. Withdraw it before deleting your account.');
    }

    const statusCounts = await this.orders.getSellerOrdersByStatus({ sellerUserId: cmd.userId });
    const hasUnresolvedOrders = statusCounts.some(
      (row) => UNRESOLVED_SELLER_ORDER_STATUSES.has(row.status) && row.count > 0,
    );
    if (hasUnresolvedOrders) {
      reasons.push(
        'You have orders that are paid but not yet delivered. Resolve them before deleting your account.',
      );
    }

    return reasons;
  }
}
