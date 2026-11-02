import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { stripeConfig } from '../../../../config/stripe.config';
import {
  ConfirmPaymentIntentInput,
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  CreateRefundInput,
  CreateRefundResult,
  CreateSetupIntentResult,
  PaymentIntentOutcome,
  PaymentProviderPort,
  ProcessorCashBalance,
  ProviderRefund,
  SavedPaymentMethod,
  VerifiedWebhookEvent,
} from '../../domain/ports/payment-provider.port';
import { toProviderStatus, toRefundStatus } from './payment-status.mapper';

// Stripe types the expanded charge's balance_transaction as `string | Stripe.BalanceTransaction`
// (string when NOT expanded, object when expanded), so both call sites —
// toOutcome's confirm/capture path and fetchChargeFee's retrieval path — go through this one
// reader. Null means "no fee object present", which every caller already treats as unknown.
function extractChargeFee(
  charge: Pick<Stripe.Charge, 'balance_transaction'> | null,
): bigint | null {
  const balanceTransaction = charge?.balance_transaction;
  if (!balanceTransaction || typeof balanceTransaction === 'string') {
    return null;
  }
  // fee === 0 is a real answer (some payment methods charge nothing) and must survive the
  // null/0 distinction: 0 records a genuine fee-free capture, null records unknown.
  return BigInt(balanceTransaction.fee);
}

@Injectable()
export class StripePaymentProviderAdapter implements PaymentProviderPort {
  private readonly stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(stripeConfig.secretKey);
  }

  async createCustomer(input: {
    userId: string;
    email: string;
  }): Promise<{ providerCustomerId: string }> {
    const customer = await this.stripe.customers.create({
      email: input.email,
      metadata: { userId: input.userId },
    });
    return { providerCustomerId: customer.id };
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    const intent = await this.stripe.paymentIntents.create({
      amount: Number(input.amount),
      currency: input.currency.toLowerCase(),
      // Manual capture: this port's create/confirm/capture are three distinct steps
      // (07-IMPLEMENTATION-PLAN.md's own P6-05 deliverable list), not Stripe's default
      // automatic-capture-on-confirm flow.
      capture_method: 'manual',
      // Stripe requires a return_url on confirm when dashboard-enabled methods may redirect off-site.
      // This app takes no redirect-based methods, so redirects are switched off and confirm works without one.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { orderId: input.orderId },
      ...(input.providerCustomerId ? { customer: input.providerCustomerId } : {}),
      ...(input.paymentMethodId ? { payment_method: input.paymentMethodId } : {}),
    });
    return {
      providerIntentId: intent.id,
      clientSecret: intent.client_secret ?? '',
      status: toProviderStatus(intent),
    };
  }

  async confirmPaymentIntent(input: ConfirmPaymentIntentInput): Promise<PaymentIntentOutcome> {
    return this.confirmOrCapture(() =>
      this.stripe.paymentIntents.confirm(input.providerIntentId, {
        ...(input.paymentMethodId ? { payment_method: input.paymentMethodId } : {}),
        // The charge's balance transaction carries the processor fee (P6-05's flagged gap,
        // closed in 3b): expanded here so the confirm's outcome records Payment.providerFee
        // at the same moment the payment itself is recorded, without a second API call.
        expand: ['latest_charge.balance_transaction'],
      }),
    );
  }

  async capturePaymentIntent(providerIntentId: string): Promise<PaymentIntentOutcome> {
    return this.confirmOrCapture(() =>
      this.stripe.paymentIntents.capture(providerIntentId, {
        // Same expansion as confirmPaymentIntent: the fee arrives with the capture instead of
        // needing a later balance-transaction fetch on the webhook path.
        expand: ['latest_charge.balance_transaction'],
      }),
    );
  }

  async createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
    const refund = await this.stripe.refunds.create({
      charge: input.providerChargeId,
      amount: Number(input.amount),
      // Stripe's own `reason` param only accepts 3 fixed enum values, unlike our free-text
      // `Refund.reason` column — passed through as metadata instead of forced into that enum.
      metadata: { reason: input.reason },
    });
    return { providerRefundId: refund.id, status: toRefundStatus(refund.status ?? null) };
  }

  async listRefunds(providerChargeId: string): Promise<ProviderRefund[]> {
    const refunds = await this.stripe.refunds.list({ charge: providerChargeId, limit: 100 });
    return refunds.data.map((refund) => ({
      providerRefundId: refund.id,
      amount: BigInt(refund.amount),
      status: toRefundStatus(refund.status ?? null),
      reason: refund.metadata?.reason ?? null,
    }));
  }

  async createSetupIntent(providerCustomerId: string): Promise<CreateSetupIntentResult> {
    // Redirects off, same as createPaymentIntent: this app collects cards in-page with Stripe's
    // card form and has no redirect flow, so confirm must not demand a return_url.
    const setupIntent = await this.stripe.setupIntents.create({
      customer: providerCustomerId,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    });
    return { providerSetupIntentId: setupIntent.id, clientSecret: setupIntent.client_secret ?? '' };
  }

  async listPaymentMethods(providerCustomerId: string): Promise<SavedPaymentMethod[]> {
    const methods = await this.stripe.paymentMethods.list({
      customer: providerCustomerId,
      type: 'card',
    });
    return methods.data.map((pm) => ({
      providerPaymentMethodId: pm.id,
      brand: pm.card?.brand ?? 'unknown',
      last4: pm.card?.last4 ?? '',
      expiryMonth: pm.card?.exp_month ?? 0,
      expiryYear: pm.card?.exp_year ?? 0,
    }));
  }

  async detachPaymentMethod(providerPaymentMethodId: string): Promise<void> {
    await this.stripe.paymentMethods.detach(providerPaymentMethodId);
  }

  // The reconciliation's 3rd check (ledger.service's getReconciliationReport) reads this via
  // PaymentsService. Stripe reports the wallet as separate `available` and `pending` bundles
  // (and can even list them per connected-account for the same currency), so they are merged
  // per currency into one row each.
  async fetchProcessorBalances(): Promise<readonly ProcessorCashBalance[]> {
    const balance = await this.stripe.balance.retrieve();
    type CurrencyAmount = Stripe.Balance['available'][number];
    const byCurrency = new Map<string, ProcessorCashBalance>();
    const seed = (c: CurrencyAmount, available: boolean): void => {
      const currency = c.currency.toUpperCase();
      const existing = byCurrency.get(currency) ?? {
        currency,
        availableMinor: BigInt(0),
        pendingMinor: BigInt(0),
      };
      byCurrency.set(currency, {
        currency,
        availableMinor: available
          ? existing.availableMinor + BigInt(c.amount)
          : existing.availableMinor,
        pendingMinor: available ? existing.pendingMinor : existing.pendingMinor + BigInt(c.amount),
      });
    };
    for (const a of balance.available) {
      seed(a, true);
    }
    for (const p of balance.pending) {
      seed(p, false);
    }
    return [...byCurrency.values()];
  }

  // Reads a charge's processor fee after the fact: the webhook path (payment_intent.succeeded)
  // only carries the charge id, so the ledger's fee posting needs this lookup (3b).
  // Stripe's `balance_transaction.fee` is the processor's whole take, in the charge's own
  // currency's minor units — no per-fee-type unrolling needed for our single-currency books.
  async fetchChargeFee(providerChargeId: string): Promise<bigint | null> {
    const charge = await this.stripe.charges.retrieve(providerChargeId, {
      expand: ['balance_transaction'],
    });
    return extractChargeFee(charge);
  }

  verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string): VerifiedWebhookEvent {
    // Throws Stripe's own StripeSignatureVerificationError on an invalid/missing signature —
    // matches the port's documented contract, no extra wrapping needed.
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signatureHeader,
      stripeConfig.webhookSecret,
    );
    return { providerEventId: event.id, type: event.type, payload: event.data.object };
  }

  // A card decline during confirm/capture usually arrives as a thrown StripeCardError, not a
  // normal response — Stripe attaches the resulting PaymentIntent snapshot (with
  // `last_payment_error` populated) to the error itself. Caught here and normalized into the
  // same `PaymentIntentOutcome` shape a non-throwing decline would produce, so the application
  // layer never has to know which path Stripe happened to take. Any other error (network, auth,
  // rate limit) is a genuine unexpected fault and propagates.
  private async confirmOrCapture(
    op: () => Promise<Stripe.PaymentIntent>,
  ): Promise<PaymentIntentOutcome> {
    try {
      const intent = await op();
      return this.toOutcome(intent);
    } catch (err) {
      if (err instanceof Stripe.errors.StripeCardError && err.payment_intent) {
        return this.toOutcome(err.payment_intent);
      }
      throw err;
    }
  }

  private toOutcome(intent: Stripe.PaymentIntent): PaymentIntentOutcome {
    const charge = intent.latest_charge;
    return {
      providerIntentId: intent.id,
      providerChargeId: typeof charge === 'string' ? charge : (charge?.id ?? null),
      status: toProviderStatus(intent),
      // The processor's fee, from the charge's balance transaction expanded at call time
      // (3b closes P6-05's flagged gap). Null whenever the expansion didn't land — the
      // Stripe SDK types the charge twice (string when unexpanded, object when expanded) —
      // and when the balance transaction itself is still a string id rather than an object.
      // A null here means "unknown", which is exactly what the nullable column records.
      providerFee: extractChargeFee(typeof charge === 'string' ? null : charge),
      failureCode: intent.last_payment_error?.code ?? null,
      failureMessage: intent.last_payment_error?.message ?? null,
    };
  }
}
