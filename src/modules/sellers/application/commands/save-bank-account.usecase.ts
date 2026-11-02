import { Injectable, Inject } from '@nestjs/common';
import { generateId } from '../../../../shared/ids/id';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import {
  SELLER_BANK_ACCOUNT_REPOSITORY,
  SellerBankAccountRepositoryPort,
} from '../../domain/ports/seller-bank-account.repository.port';
import { SellerApplicationNotFoundError } from '../../domain/errors/sellers.errors';

export interface SaveBankAccountCommand {
  readonly userId: string;
  readonly accountHolder: string;
  // Raw account number, never persisted (see NOTE below) — only its last 4 digits survive.
  readonly accountNumber: string;
  readonly bankName?: string;
  readonly country: string;
  readonly currency: string;
}

export interface SaveBankAccountResult {
  readonly sellerId: string;
  readonly last4: string;
}

const MIN_ACCOUNT_NUMBER_LENGTH = 4;

@Injectable()
export class SaveBankAccountUseCase {
  constructor(
    @Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort,
    @Inject(SELLER_BANK_ACCOUNT_REPOSITORY) private readonly bankAccounts: SellerBankAccountRepositoryPort,
  ) {}

  async execute(cmd: SaveBankAccountCommand): Promise<Result<SaveBankAccountResult, SellerApplicationNotFoundError>> {
    const seller = await this.sellers.findByUserId(cmd.userId);
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`user ${cmd.userId}`));
    }

    const last4 = cmd.accountNumber.slice(-MIN_ACCOUNT_NUMBER_LENGTH);
    // NOTE: no real encryption/tokenization vault exists in this codebase yet — that's blocked on
    // D-001 (legal cover for holding funds) and an as-yet-undecided KMS/vault mechanism in
    // 02-TRD.md. `encryptedRef` is an opaque placeholder token, NOT a security mechanism: the raw
    // account number above is used only to derive `last4` and is discarded immediately after,
    // never written to storage or logs. Replace this whole block once a real vault is chosen.
    const encryptedRef = `PLACEHOLDER-${generateId()}`;

    const bankAccount = await this.bankAccounts.upsert({
      id: generateId(),
      sellerId: seller.id,
      accountHolder: cmd.accountHolder,
      last4,
      encryptedRef,
      bankName: cmd.bankName,
      country: cmd.country,
      currency: cmd.currency,
    });

    return Ok({ sellerId: seller.id, last4: bankAccount.last4 });
  }
}
