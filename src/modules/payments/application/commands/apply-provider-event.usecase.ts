import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { generateId } from '../../../../shared/ids/id';
import { EVENT_BUS, EventBusPort } from '../../../../shared/events/event-bus.port';
import {
  PAYMENT_REPOSITORY,
  PaymentRepositoryPort,
} from '../../domain/ports/payment.repository.port';
import { REFUND_REPOSITORY, RefundRepositoryPort } from '../../domain/ports/refund.repository.port';
import { PAYMENT_PROVIDER, PaymentProviderPort } from '../../domain/ports/payment-provider.port';
import { Payment } from '../../domain/entities/payment.entity';
import { OrdersService } from '../../../orders/application/orders.service';
import { paymentRefundedEvent } from '../../events/published/payment-refunded.event';
import { mapProviderStatusToPaymentStatus } from '../map-provider-status';

export interface ApplyProviderEventCommand {
  readonly type: string;
  // The verified event's `data.object` (a PaymentIntent, Charge, Refund or Dispute).
  readonly payload: unknown;
}

// What happened, for the job log. `ignored` is a normal answer: the event is for something this
// system does not track (another account's object, an event type nobody asked for).
export type ApplyProviderEventOutcome = 'applied' | 'already-applied' | 'ignored';

const ChargeRef = z.union([z.string(), z.object({ id: z.string() }).passthrough()]).nullish();

const IntentSchema = z
  .object({
    id: z.string(),
    latest_charge: ChargeRef,
    last_payment_error: z
      .object({ code: z.string().nullish(), message: z.string().nullish() })
      .passthrough()
      .nullish(),
  })
  .passthrough();

const ChargeSchema = z.object({ id: z.string() }).passthrough();
// `charge.refund.updated` delivers a Refund, which points at its charge instead of being one.
const RefundSchema = z.object({ charge: z.string() }).passthrough();
const DisputeSchema = z.object({ id: z.string(), charge: z.string() }).passthrough();

const SETTLED: Payment['status'][] = ['SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED'];

function chargeId(ref: z.infer<typeof ChargeRef>): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref.id;
}

// Step 4 of 05-API-SPEC.md §9's webhook algorithm: the job that turns a verified, de-duplicated
// processor event into state changes. Safe to run twice for the same event: every branch looks at
// the current state first and does nothing if the change is already in place, and the order and
// ledger side effects go through the same use cases as the in-app payment path (`markPaid`
// publishes `order.paid.v1`, which the ledger listens to).
//
// Handled: `payment_intent.succeeded`, `payment_intent.payment_failed`,
// `payment_intent.amount_capturable_updated` (a card that needed extra authentication, such as
// 3-D Secure, completed outside this server: capture it now), `charge.refunded` and
// `charge.refund.updated` (refunds made in the Stripe dashboard or settling late — since 3b
// these are also BOOKED, not just recorded: new or newly-succeeded Refund rows publish the
// same payment.refunded event as the in-app path), and `charge.dispute.created`. Everything
// else is ignored.
@Injectable()
export class ApplyProviderEventUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepositoryPort,
    @Inject(REFUND_REPOSITORY) private readonly refunds: RefundRepositoryPort,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProviderPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    private readonly orders: OrdersService,
  ) {}

  async execute(cmd: ApplyProviderEventCommand): Promise<ApplyProviderEventOutcome> {
    switch (cmd.type) {
      case 'payment_intent.succeeded':
        return this.onSucceeded(IntentSchema.parse(cmd.payload));
      case 'payment_intent.payment_failed':
        return this.onFailed(IntentSchema.parse(cmd.payload));
      case 'payment_intent.amount_capturable_updated':
        return this.onCapturable(IntentSchema.parse(cmd.payload));
      case 'charge.refunded':
        return this.reconcileRefunds(ChargeSchema.parse(cmd.payload).id);
      case 'charge.refund.updated':
        return this.reconcileRefunds(RefundSchema.parse(cmd.payload).charge);
      case 'charge.dispute.created':
        return this.onDisputeCreated(DisputeSchema.parse(cmd.payload));
      default:
        return 'ignored';
    }
  }

  private async onSucceeded(
    intent: z.infer<typeof IntentSchema>,
  ): Promise<ApplyProviderEventOutcome> {
    const payment = await this.payments.findByProviderIntentId(intent.id);
    if (!payment) return 'ignored';
    if (SETTLED.includes(payment.status)) return 'already-applied';

    const chargeIdValue = chargeId(intent.latest_charge) ?? payment.providerChargeId;
    // Webhook payloads arrive unexpanded, so the fee needs its own fetch (3b closes P6-05).
    // Deliberately best-effort: a transient Stripe failure here must not block the SUCCEEDED
    // marking (the money DID land), which the retry path can never revisit once SETTLED —
    // a missed fee re-surfaces in the nightly reconciliation's cash check either way.
    let foundFee: bigint | null = null;
    if (chargeIdValue) {
      try {
        foundFee = await this.provider.fetchChargeFee(chargeIdValue);
      } catch {
        // Fee unknown → the ledger's cash posting for this payment simply omits its
        // PROCESSOR_FEES pair; reconciliation compares cash and flags the residue.
      }
    }

    const settled = await this.payments.updateOutcome(payment.id, {
      status: 'SUCCEEDED',
      providerChargeId: chargeIdValue,
      providerFee: foundFee ?? payment.providerFee,
      failureCode: null,
      failureMessage: null,
      capturedAt: new Date(),
    });
    // An order that is no longer waiting for payment (cancelled meanwhile) refuses the transition;
    // the payment record is still correct, so that refusal is not an error here.
    await this.orders.markPaid({
      orderId: settled.orderId,
      paymentId: settled.id,
      providerFeeMinor: foundFee ?? settled.providerFee,
    });
    return 'applied';
  }

  private async onFailed(intent: z.infer<typeof IntentSchema>): Promise<ApplyProviderEventOutcome> {
    const payment = await this.payments.findByProviderIntentId(intent.id);
    if (!payment) return 'ignored';
    if (SETTLED.includes(payment.status)) return 'already-applied';

    await this.payments.updateOutcome(payment.id, {
      status: 'FAILED',
      providerChargeId: payment.providerChargeId,
      providerFee: payment.providerFee,
      failureCode: intent.last_payment_error?.code ?? null,
      failureMessage: intent.last_payment_error?.message ?? null,
      capturedAt: null,
    });
    return 'applied';
  }

  private async onCapturable(
    intent: z.infer<typeof IntentSchema>,
  ): Promise<ApplyProviderEventOutcome> {
    const payment = await this.payments.findByProviderIntentId(intent.id);
    if (!payment) return 'ignored';
    if (SETTLED.includes(payment.status)) return 'already-applied';

    let outcome;
    try {
      outcome = await this.provider.capturePaymentIntent(payment.providerIntentId);
    } catch (err) {
      // The normal in-app path confirms and captures in the same request, and this event arrives
      // right behind it. Stripe refuses a second capture with this code: someone else has it.
      if ((err as { code?: string }).code === 'payment_intent_unexpected_state')
        return 'already-applied';
      throw err;
    }

    const status = mapProviderStatusToPaymentStatus(outcome.status);
    const updated = await this.payments.updateOutcome(payment.id, {
      status,
      providerChargeId: outcome.providerChargeId,
      providerFee: outcome.providerFee,
      failureCode: outcome.failureCode,
      failureMessage: outcome.failureMessage,
      capturedAt: status === 'SUCCEEDED' ? new Date() : null,
    });
    if (status === 'SUCCEEDED') {
      await this.orders.markPaid({
        orderId: updated.orderId,
        paymentId: updated.id,
        providerFeeMinor: updated.providerFee,
      });
    }
    return 'applied';
  }

  // Brings our Refund rows in line with what the processor says about the charge, including
  // refunds that were not made through the app. Re-running changes nothing once they match.
  private async reconcileRefunds(providerChargeId: string): Promise<ApplyProviderEventOutcome> {
    const payment = await this.payments.findByProviderChargeId(providerChargeId);
    if (!payment) return 'ignored';

    let changed = false;
    let lastRefundId: string | null = null;
    for (const remote of await this.provider.listRefunds(providerChargeId)) {
      const existing = await this.refunds.findByProviderRefundId(remote.providerRefundId);
      if (!existing) {
        const created = await this.refunds.create({
          id: generateId(),
          paymentId: payment.id,
          providerRefundId: remote.providerRefundId,
          amount: remote.amount,
          reason: remote.reason ?? 'Refunded outside the app',
          status: remote.status,
          initiatedByUserId: null,
        });
        // Money the app did not send back itself (Stripe dashboard refunds and the like) still
        // has to leave the books: 3b publishes it on the same payment.refunded event the
        // in-app path uses, deduped ledger-side by the provider refund id. Only succeeds
        // emit — a PENDING refund's cash hasn't moved yet; charge.refund.updated brings the
        // terminal status here and emits then.
        if (remote.status === 'SUCCEEDED') {
          await this.emitRefundLedgered({
            payment,
            refundId: created.id,
            providerRefundId: remote.providerRefundId,
            amount: remote.amount,
          });
        }
        lastRefundId = created.id;
        changed = true;
      } else {
        lastRefundId = existing.id;
        if (existing.status !== remote.status) {
          await this.refunds.updateStatus(existing.id, remote.status);
          if (remote.status === 'SUCCEEDED') {
            // An in-app refund created as PENDING (execute) settles into the wallet later;
            // this is its only money-movement moment, same emit as the created branch.
            await this.emitRefundLedgered({
              payment,
              refundId: existing.id,
              providerRefundId: remote.providerRefundId,
              amount: existing.amount,
            });
          }
          changed = true;
        }
      }
    }

    const refunded = await this.refunds.sumSucceededByPaymentId(payment.id);
    const target =
      refunded >= payment.amount ? 'REFUNDED' : refunded > 0n ? 'PARTIALLY_REFUNDED' : null;
    if (target && payment.status !== target) {
      await this.payments.markRefundStatus(payment.id, target);
      changed = true;
    }
    // Same rule as the in-app refund: only a full refund moves the order itself.
    if (target === 'REFUNDED' && lastRefundId) {
      const marked = await this.orders.markRefunded({
        orderId: payment.orderId,
        refundId: lastRefundId,
      });
      if (marked.ok) changed = true;
    }
    return changed ? 'applied' : 'already-applied';
  }

  private async onDisputeCreated(
    dispute: z.infer<typeof DisputeSchema>,
  ): Promise<ApplyProviderEventOutcome> {
    const payment = await this.payments.findByProviderChargeId(dispute.charge);
    if (!payment) return 'ignored';
    const marked = await this.orders.markDisputed({
      orderId: payment.orderId,
      disputeId: dispute.id,
    });
    return marked.ok ? 'applied' : 'already-applied';
  }

  // 3b: publish the money side of a refund already persisted here (created or just settled).
  // Needs the order's own order.paid composition for the ledger's refund split, hence the
  // getOrder round-trip — the one extra fetch per refund event, for the same reason
  // mark-order-paid carries its numbers: the ledger must post without reaching into orders
  // or payments tables itself.
  private async emitRefundLedgered(cmd: {
    payment: Payment;
    refundId: string;
    providerRefundId: string;
    amount: bigint;
  }): Promise<void> {
    const order = await this.orders.getOrder({ orderId: cmd.payment.orderId });
    if (!order) {
      // Not reachable through any known flow (refund rows only exist for settled charges
      // against real orders) — skip rather than post a split against nothing. If some future
      // flow breaks that invariant, the nightly reconciliation cash check catches the drift.
      return;
    }
    await this.eventBus.publish(
      paymentRefundedEvent({
        refundId: cmd.refundId,
        providerRefundId: cmd.providerRefundId,
        paymentId: cmd.payment.id,
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
}
