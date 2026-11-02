import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { generateId } from '../../../../shared/ids/id';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  PAYMENT_REPOSITORY,
  PaymentRepositoryPort,
} from '../../domain/ports/payment.repository.port';
import { REFUND_REPOSITORY, RefundRepositoryPort } from '../../domain/ports/refund.repository.port';
import { PAYMENT_PROVIDER, PaymentProviderPort } from '../../domain/ports/payment-provider.port';
import {
  OrderNotFoundError,
  PaymentNotFoundError,
  PaymentNotSucceededError,
  RefundExceedsRemainingError,
} from '../../domain/errors/payments.errors';
import { OrdersService } from '../../../orders/application/orders.service';
import { paymentRefundedEvent } from '../../events/published/payment-refunded.event';

export interface RefundPaymentCommand {
  readonly orderId: string;
  readonly initiatedByUserId: string;
  readonly amount: bigint;
  readonly reason: string;
}

export interface RefundPaymentResult {
  readonly refundId: string;
  readonly paymentStatus: 'REFUNDED' | 'PARTIALLY_REFUNDED';
  readonly orderStatus: string;
}

// 07-IMPLEMENTATION-PLAN.md's P6-07 "refund" deliverable. No HTTP route is documented anywhere
// for issuing a refund (05-API-SPEC.md §9 only names setup-intent/methods/pay/webhook) — same
// "built the logic, no route owns exposing it yet" gap as every prior ticket in this build that
// built a use case before its API ticket existed (e.g. P4-06's ban/unban). Flagged, not blocking.
@Injectable()
export class RefundPaymentUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepositoryPort,
    @Inject(REFUND_REPOSITORY) private readonly refunds: RefundRepositoryPort,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProviderPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly orders: OrdersService,
  ) {}

  async execute(
    cmd: RefundPaymentCommand,
  ): Promise<
    Result<
      RefundPaymentResult,
      | OrderNotFoundError
      | PaymentNotFoundError
      | PaymentNotSucceededError
      | RefundExceedsRemainingError
    >
  > {
    const order = await this.orders.getOrder({ orderId: cmd.orderId });
    if (!order) {
      return Err(new OrderNotFoundError(cmd.orderId));
    }

    const payment = await this.payments.findByOrderId(order.id);
    if (!payment) {
      return Err(new PaymentNotFoundError(order.id));
    }

    // A payment that never succeeded has nothing to refund; one already fully REFUNDED fails
    // this check too (a second refund attempt against it is correctly rejected here, not by a
    // remaining-amount check that would otherwise divide-by-zero-shaped edge case).
    if (payment.status !== 'SUCCEEDED' && payment.status !== 'PARTIALLY_REFUNDED') {
      return Err(new PaymentNotSucceededError(payment.id));
    }
    if (!payment.providerChargeId) {
      // SUCCEEDED/PARTIALLY_REFUNDED only ever get set after a real capture populates
      // providerChargeId — a miss here is a data-integrity bug, not a reachable business case.
      throw new Error(`Payment ${payment.id} has no providerChargeId to refund against`);
    }

    const alreadyRefunded = await this.refunds.sumSucceededByPaymentId(payment.id);
    const remaining = payment.amount - alreadyRefunded;
    if (cmd.amount > remaining) {
      return Err(new RefundExceedsRemainingError(payment.id, cmd.amount, remaining));
    }

    const providerRefund = await this.provider.createRefund({
      providerChargeId: payment.providerChargeId,
      amount: cmd.amount,
      reason: cmd.reason,
    });

    const refund = await this.refunds.create({
      id: generateId(),
      paymentId: payment.id,
      providerRefundId: providerRefund.providerRefundId,
      amount: cmd.amount,
      reason: cmd.reason,
      status: providerRefund.status,
      initiatedByUserId: cmd.initiatedByUserId,
    });

    const isFullRefund = providerRefund.status === 'SUCCEEDED' && cmd.amount === remaining;
    const updatedPayment = await this.payments.markRefundStatus(
      payment.id,
      isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
    );

    // 3b: book the money side. Only for a SUCCEEDED refund — a PENDING one's cash has not
    // left Stripe yet; when it settles, the charge.refund.updated path (reconcileRefunds)
    // emits at exactly that moment, and the ledger-side idempotency anchored on the provider
    // refund id means emit-at-create and emit-at-settle can never both post.
    if (providerRefund.status === 'SUCCEEDED') {
      await this.eventBus.publish(
        paymentRefundedEvent({
          refundId: refund.id,
          providerRefundId: providerRefund.providerRefundId,
          paymentId: payment.id,
          orderId: order.id,
          sellerId: order.sellerId,
          currency: order.currency,
          refundAmount: cmd.amount.toString(),
          itemAmount: order.itemAmount.toString(),
          commissionAmount: order.commissionAmount.toString(),
          sellerNetAmount: order.sellerNetAmount.toString(),
          refundedAt: new Date().toISOString(),
        }),
      );
    }

    // Order-level REFUNDED is only attempted for a full refund, and only when the order's own
    // status is still one of REFUND's legal origins (PAID/SHIPPED/DELIVERED/COMPLETED per
    // order-status-transition.rule.ts) — e.g. an order already CANCELLED stays CANCELLED; the
    // payment-level refund above is still honored either way. No doc defines this precedence,
    // flagged as a reasoned reading, same treatment as P6-03's own REFUND origin set.
    let orderStatus: string = order.status;
    if (isFullRefund) {
      const marked = await this.orders.markRefunded({ orderId: order.id, refundId: refund.id });
      if (marked.ok) {
        orderStatus = marked.value.status;
      }
    }

    return Ok({
      refundId: refund.id,
      paymentStatus: updatedPayment.status as 'REFUNDED' | 'PARTIALLY_REFUNDED',
      orderStatus,
    });
  }

  // Called from OnOrderCancelledHandler (events/handlers, this module) when a seller/admin
  // cancels a PAID order — the money side of that cancel. Deliberately does NOT call
  // `this.orders.markRefunded`: the order is already CANCELLED by the time this runs (the use
  // case that published order.cancelled already committed that transition), and REFUND's legal
  // origin set (order-status-transition.rule.ts: PAID/SHIPPED/DELIVERED/COMPLETED) doesn't
  // include CANCELLED — Order.status and Payment.status are independent fields here by design,
  // same as execute()'s own "an order already CANCELLED stays CANCELLED" comment above.
  // (3b) Also deliberately does NOT publish payment.refunded: the ledger already booked this
  // exact money movement as order.cancelled's full reversal (OnOrderCancelledHandler in the
  // ledger module) — emitting here too would credit PLATFORM_CASH twice for the same refund.
  // Silently no-ops (not an error) when there's genuinely nothing to refund: no Payment row at
  // all, a Payment that never succeeded, or one already fully refunded — all reachable, none a
  // real failure.
  async refundForCancelledOrder(cmd: {
    orderId: string;
    initiatedByUserId: string;
    reason: string;
  }): Promise<void> {
    const payment = await this.payments.findByOrderId(cmd.orderId);
    if (!payment) {
      return;
    }
    if (payment.status !== 'SUCCEEDED' && payment.status !== 'PARTIALLY_REFUNDED') {
      return;
    }
    if (!payment.providerChargeId) {
      return;
    }

    const alreadyRefunded = await this.refunds.sumSucceededByPaymentId(payment.id);
    const remaining = payment.amount - alreadyRefunded;
    if (remaining <= 0n) {
      return;
    }

    const providerRefund = await this.provider.createRefund({
      providerChargeId: payment.providerChargeId,
      amount: remaining,
      reason: cmd.reason,
    });

    await this.refunds.create({
      id: generateId(),
      paymentId: payment.id,
      providerRefundId: providerRefund.providerRefundId,
      amount: remaining,
      reason: cmd.reason,
      status: providerRefund.status,
      initiatedByUserId: cmd.initiatedByUserId,
    });

    await this.payments.markRefundStatus(
      payment.id,
      providerRefund.status === 'SUCCEEDED' ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
    );
  }
}
