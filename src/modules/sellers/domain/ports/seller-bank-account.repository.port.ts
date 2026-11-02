import { SellerBankAccount } from '../entities/seller-bank-account.entity';

export const SELLER_BANK_ACCOUNT_REPOSITORY = Symbol('SellerBankAccountRepositoryPort');

export interface UpsertBankAccountInput {
  readonly id: string;
  readonly sellerId: string;
  readonly accountHolder: string;
  readonly last4: string;
  readonly encryptedRef: string;
  readonly bankName: string | undefined;
  readonly country: string;
  readonly currency: string;
}

export interface SellerBankAccountRepositoryPort {
  upsert(input: UpsertBankAccountInput): Promise<SellerBankAccount>;
}
