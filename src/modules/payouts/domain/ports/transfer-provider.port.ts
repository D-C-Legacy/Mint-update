export const TRANSFER_PROVIDER = Symbol('TransferProviderPort');

export interface CreateTransferInput {
  readonly sellerId: string;
  readonly amount: bigint;
  readonly currency: string;
  readonly idempotencyKey: string;
}

export interface TransferOutcome {
  readonly status: 'SENT' | 'FAILED';
  readonly providerTransferId: string | null;
  readonly failureReason: string | null;
}

// A real transfer to a seller's bank account needs a money-movement rail this stack doesn't
// have: 02-TRD.md §1 explicitly scopes Stripe to "charges only, not Connect," and no other
// payout rail is named anywhere in the docs — D-001/D-002 (09-DECISIONS.md) are exactly why,
// both still open. No `Result` wrapping, matching `StreamProviderPort`/`PaymentProviderPort`'s
// own precedent — a provider-level fault should throw; a declined/failed transfer is ordinary
// data (`TransferOutcome.status = 'FAILED'`), the same split `PaymentProviderPort` already
// established for a declined card.
export interface TransferProviderPort {
  createTransfer(input: CreateTransferInput): Promise<TransferOutcome>;
}
