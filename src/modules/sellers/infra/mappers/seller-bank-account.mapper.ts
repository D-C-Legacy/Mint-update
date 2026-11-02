import type { SellerBankAccount as PrismaSellerBankAccount } from '@prisma/client';
import { SellerBankAccount } from '../../domain/entities/seller-bank-account.entity';

export function toDomainSellerBankAccount(row: PrismaSellerBankAccount): SellerBankAccount {
  return {
    id: row.id,
    sellerId: row.sellerId,
    accountHolder: row.accountHolder,
    last4: row.last4,
    encryptedRef: row.encryptedRef,
    bankName: row.bankName,
    country: row.country,
    currency: row.currency,
    verifiedAt: row.verifiedAt,
  };
}
