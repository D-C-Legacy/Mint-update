import { Injectable } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { CreateTransferInput, TransferOutcome, TransferProviderPort } from '../../domain/ports/transfer-provider.port';

// **Non-production placeholder, same treatment as P2-06's SellerBankAccount.encryptedRef.**
// Always "succeeds" with a fake `providerTransferId` — no real money moves, no real bank
// account is ever contacted. There is no real adapter to swap this for yet: Stripe is scoped to
// charges only in this stack (02-TRD.md §1, "not Connect"), and no other transfer rail is named
// anywhere in the docs. Blocked on D-001/D-002 (09-DECISIONS.md), both still open. **Do not
// treat this as done or let a real payout run reach it in production** — replace with a real
// `TransferProviderPort` implementation once a legal/infra decision actually names a rail.
@Injectable()
export class MockTransferAdapter implements TransferProviderPort {
  createTransfer(input: CreateTransferInput): Promise<TransferOutcome> {
    return Promise.resolve({
      status: 'SENT',
      providerTransferId: `MOCK-TRANSFER-${input.idempotencyKey}-${generateId()}`,
      failureReason: null,
    });
  }
}
