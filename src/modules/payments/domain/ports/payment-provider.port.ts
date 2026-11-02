export const PAYMENT_PROVIDER = Symbol('PaymentProviderPort');

// Mirrors `Payment.status` (03-DATA-MODEL.md §9) minus REFUNDED/PARTIALLY_REFUNDED, which this
// codebase derives from `Refund` rows rather than the provider echoing them back on the intent
// itself (Stripe doesn't report a refund on the PaymentIntent object either).
export type ProviderPaymentStatus =
  'REQUIRES_PAYMENT' | 'REQUIRES_CAPTURE' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface CreatePaymentIntentInput {
  readonly orderId: string;
  readonly amount: bigint;
  readonly currency: string;
  readonly providerCustomerId?: string;
  readonly paymentMethodId?: string;
}

export interface CreatePaymentIntentResult {
  readonly providerIntentId: string;
  readonly clientSecret: string;
  readonly status: ProviderPaymentStatus;
}

export interface ConfirmPaymentIntentInput {
  readonly providerIntentId: string;
  readonly paymentMethodId?: string;
}

// Shared return shape for confirm/capture: a declined card is a normal, expected business
// outcome (`Payment.status = FAILED` with `failureCode`/`failureMessage`, both already columns
// on the schema per 03-DATA-MODEL.md §9), not a thrown exception — mirrors how Stripe's own API
// behaves (a decline is a normal PaymentIntent response, not an HTTP error). Only a genuine
// provider-level fault (network, auth, rate limit) should throw; the application layer (P6-07)
// maps this result onto `Payment.status` either way.
export interface PaymentIntentOutcome {
  readonly providerIntentId: string;
  readonly providerChargeId: string | null;
  readonly status: ProviderPaymentStatus;
  readonly providerFee: bigint | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
}

export interface CreateRefundInput {
  readonly providerChargeId: string;
  readonly amount: bigint;
  readonly reason: string;
}

export interface CreateRefundResult {
  readonly providerRefundId: string;
  readonly status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
}

// One refund as the processor reports it. Used to pick up refunds made outside the app (for
// example from the Stripe dashboard) when a `charge.refunded` webhook arrives.
export interface ProviderRefund {
  readonly providerRefundId: string;
  readonly amount: bigint;
  readonly status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  readonly reason: string | null;
}

export interface CreateSetupIntentResult {
  readonly providerSetupIntentId: string;
  readonly clientSecret: string;
}

export interface SavedPaymentMethod {
  readonly providerPaymentMethodId: string;
  readonly brand: string;
  readonly last4: string;
  readonly expiryMonth: number;
  readonly expiryYear: number;
}

// The processor's current real cash position, per currency — what the ledger reconciliation's
// 3rd check (03-DATA-MODEL.md §10: "ledger cash matches processor totals") compares the ledger's
// own PLATFORM_CASH against. Stripe's wallet is split into `available` (movable now) and
// `pending` (maturing first); both together are the actual cash on hand. Minor units, BigInt,
// per the repo's Money rule. Built for 3c (engineering backlog Phase 3).
export interface ProcessorCashBalance {
  readonly currency: string;
  readonly availableMinor: bigint;
  readonly pendingMinor: bigint;
}

export interface VerifiedWebhookEvent {
  readonly providerEventId: string;
  readonly type: string;
  readonly payload: unknown;
}

// 07-IMPLEMENTATION-PLAN.md's P6-05 deliverable list in one interface: PaymentIntent
// create/confirm/capture, refund, saved payment methods, signature verification. No Result
// wrapping, same precedent as `StreamProviderPort` (P4-02) — provider I/O failures are
// unexpected-infra, thrown, not an expected domain `Result`; the one deliberate exception is
// `PaymentIntentOutcome`'s status/failure fields, which exist precisely so a decline doesn't
// have to be modeled as a thrown error.
//
// `createCustomer`/the `providerCustomerId` parameters below are a flagged gap, not an oversight:
// 05-API-SPEC.md §9 documents `POST /payments/setup-intent` and `GET/DELETE /payments/methods*`
// (saving and managing cards), which need a Stripe Customer per user, but no doc anywhere defines
// a column to persist that customer id against (no `User.stripeCustomerId`, no `Payments`-owned
// per-user table). This port still declares the methods, taking `providerCustomerId` as an
// explicit input rather than resolving it internally — same shape as `StreamProviderPort` taking
// `providerRoomId` rather than looking it up itself — so the open question is only "where do we
// store this id", not "what does the provider call look like". Whichever ticket wires the actual
// HTTP routes (P6-07 per the plan) needs to resolve this before `createSetupIntent`/
// `listPaymentMethods` are reachable end to end.
export interface PaymentProviderPort {
  createCustomer(input: { userId: string; email: string }): Promise<{ providerCustomerId: string }>;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>;
  confirmPaymentIntent(input: ConfirmPaymentIntentInput): Promise<PaymentIntentOutcome>;
  capturePaymentIntent(providerIntentId: string): Promise<PaymentIntentOutcome>;
  createRefund(input: CreateRefundInput): Promise<CreateRefundResult>;
  listRefunds(providerChargeId: string): Promise<ProviderRefund[]>;
  createSetupIntent(providerCustomerId: string): Promise<CreateSetupIntentResult>;
  listPaymentMethods(providerCustomerId: string): Promise<SavedPaymentMethod[]>;
  detachPaymentMethod(providerPaymentMethodId: string): Promise<void>;
  /** The processor's real current cash per currency (Stripe balance, available + pending). */
  fetchProcessorBalances(): Promise<readonly ProcessorCashBalance[]>;
  /**
   * The processor fee recorded on a specific charge's balance transaction (minor units), or
   * null when the processor has not produced one yet (a charge that has not settled, or a
   * fetch that raced the balance transaction's creation). The number the ledger's
   * PROCESSOR_FEES postings need (3b): Stripe's wallet is fee-net, so without this the
   * ledger's cash can never match the processor's — this is P6-05's flagged
   * "providerFee never populated" gap, closed.
   */
  fetchChargeFee(providerChargeId: string): Promise<bigint | null>;
  /** Throws on an invalid/missing signature — never returns a "maybe verified" result. */
  verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string): VerifiedWebhookEvent;
}
