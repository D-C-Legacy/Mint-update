import { Inject, Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { generateId } from '../../../../shared/ids/id';
import {
  PAYMENT_REPOSITORY,
  PaymentRepositoryPort,
} from '../../domain/ports/payment.repository.port';
import { PAYMENT_PROVIDER, PaymentProviderPort } from '../../domain/ports/payment-provider.port';
import { Payment } from '../../domain/entities/payment.entity';
import {
  OrderNotFoundError,
  OrderNotPayableError,
  IdempotencyKeyRequiredError,
  PaymentMethodNotFoundError,
} from '../../domain/errors/payments.errors';
import { ProviderCustomerResolver } from '../provider-customer.resolver';
import { OrdersService } from '../../../orders/application/orders.service';
import { mapProviderStatusToPaymentStatus } from '../map-provider-status';

export interface PayOrderCommand {
  readonly orderId: string;
  readonly buyerUserId: string;
  readonly idempotencyKey: string;
  readonly paymentMethodId?: string;
}

export interface PayOrderResult {
  readonly orderId: string;
  readonly paymentId: string;
  readonly status: Payment['status'];
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
}

// 07-IMPLEMENTATION-PLAN.md's P6-07 deliverable: "pay order (Idempotency-Key required), retry,
// refund, emits order.paid.v1". "retry" is not a separate use case here — no HTTP route is
// documented anywhere for a distinct retry endpoint, only `POST /orders/:id/pay` (05-API-SPEC.md
// §9), so calling THIS use case again after a decline IS the retry path: `retryExisting` below
// reuses the already-created PaymentIntent rather than creating a second one. "emits
// order.paid.v1" happens inside `OrdersService.markPaid`, not here — same precedent as sales
// publishing `sale.resolved.v1` from whichever use case owns the actual state transition.
@Injectable()
export class PayOrderUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepositoryPort,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProviderPort,
    private readonly orders: OrdersService,
    private readonly customers: ProviderCustomerResolver,
  ) {}

  async execute(
    cmd: PayOrderCommand,
  ): Promise<
    Result<
      PayOrderResult,
      | OrderNotFoundError
      | OrderNotPayableError
      | IdempotencyKeyRequiredError
      | PaymentMethodNotFoundError
    >
  > {
    if (cmd.idempotencyKey.trim().length === 0) {
      return Err(new IdempotencyKeyRequiredError());
    }

    const order = await this.orders.getOrder({ orderId: cmd.orderId });
    // 404, not 403, either way — a missing order and one that isn't this buyer's look identical
    // to an unauthorized caller, same ownership-masking precedent as catalog/sales (P3-02).
    if (!order || order.buyerUserId !== cmd.buyerUserId) {
      return Err(new OrderNotFoundError(cmd.orderId));
    }

    // Acceptance criterion: "paying an order charges once even if the endpoint is called 5 times
    // with the same key." Once Order.status is PAID, short-circuit entirely — no Stripe call at
    // all on this path, just hand back the already-settled result.
    if (order.status === 'PAID') {
      const existing = await this.payments.findByOrderId(order.id);
      if (!existing) {
        // Order.status only ever becomes PAID via MarkOrderPaidUseCase, which requires a
        // paymentId — a miss here is a genuine data-integrity bug, not a reachable case.
        throw new Error(`Order ${order.id} is PAID but has no Payment row`);
      }
      return Ok(this.toResult(existing));
    }

    // Orders' own order-status-transition.rule.ts enforces PAY only from PENDING_PAYMENT — not
    // re-imported here (cross-module domain import), just the one stable, simple fact checked
    // locally against whatever OrdersService.getOrder() already returned.
    if (order.status !== 'PENDING_PAYMENT') {
      return Err(new OrderNotPayableError(order.id, order.status));
    }

    // A saved card must be one of THIS buyer's own cards, and the charge is made against their
    // Stripe customer (Stripe refuses a customer's card used without that customer).
    let providerCustomerId: string | undefined;
    if (cmd.paymentMethodId) {
      const customerId = await this.customers.find(cmd.buyerUserId);
      const mine = customerId ? await this.provider.listPaymentMethods(customerId) : [];
      if (!customerId || !mine.some((m) => m.providerPaymentMethodId === cmd.paymentMethodId)) {
        return Err(new PaymentMethodNotFoundError(cmd.paymentMethodId));
      }
      providerCustomerId = customerId;
    }

    const existingPayment = await this.payments.findByOrderId(order.id);
    const outcome = existingPayment
      ? await this.confirmAndCapture(existingPayment, cmd.paymentMethodId)
      : await this.payFresh(
          order.id,
          order.totalAmount,
          order.currency,
          cmd.paymentMethodId,
          providerCustomerId,
        );

    if (outcome.status === 'SUCCEEDED') {
      // If this loses a race to another concurrent call that already marked the order PAID,
      // that's fine — whichever call actually won the transition already published
      // order.paid.v1; this one must not publish a second time.
      await this.orders.markPaid({
        orderId: order.id,
        paymentId: outcome.id,
        providerFeeMinor: outcome.providerFee,
      });
    }

    return Ok(this.toResult(outcome));
  }

  private async payFresh(
    orderId: string,
    amount: bigint,
    currency: string,
    paymentMethodId: string | undefined,
    providerCustomerId: string | undefined,
  ): Promise<Payment> {
    const created = await this.provider.createPaymentIntent({
      orderId,
      amount,
      currency,
      ...(providerCustomerId ? { providerCustomerId } : {}),
      ...(paymentMethodId ? { paymentMethodId } : {}),
    });
    const payment = await this.payments.create({
      id: generateId(),
      orderId,
      providerIntentId: created.providerIntentId,
      amount,
      currency,
    });
    // `payments.create` returns the WINNING row under a concurrent-race P2002 (see
    // PaymentRepositoryPort's own doc comment) — always confirm/capture against whatever it
    // actually returned, which may not be the intent this call just created.
    return this.confirmAndCapture(payment, paymentMethodId);
  }

  private async confirmAndCapture(
    payment: Payment,
    paymentMethodId: string | undefined,
  ): Promise<Payment> {
    const confirmed = await this.provider.confirmPaymentIntent({
      providerIntentId: payment.providerIntentId,
      ...(paymentMethodId ? { paymentMethodId } : {}),
    });
    const outcome =
      confirmed.status === 'REQUIRES_CAPTURE'
        ? await this.provider.capturePaymentIntent(payment.providerIntentId)
        : confirmed;

    return this.payments.updateOutcome(payment.id, {
      status: mapProviderStatusToPaymentStatus(outcome.status),
      providerChargeId: outcome.providerChargeId,
      providerFee: outcome.providerFee,
      failureCode: outcome.failureCode,
      failureMessage: outcome.failureMessage,
      capturedAt: outcome.status === 'SUCCEEDED' ? new Date() : null,
    });
  }

  private toResult(payment: Payment): PayOrderResult {
    return {
      orderId: payment.orderId,
      paymentId: payment.id,
      status: payment.status,
      failureCode: payment.failureCode,
      failureMessage: payment.failureMessage,
    };
  }
}
