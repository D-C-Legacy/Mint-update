import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  SellerBankAccountRepositoryPort,
  UpsertBankAccountInput,
} from '../../domain/ports/seller-bank-account.repository.port';
import { SellerBankAccount } from '../../domain/entities/seller-bank-account.entity';
import { toDomainSellerBankAccount } from '../mappers/seller-bank-account.mapper';

@Injectable()
export class SellerBankAccountPrismaRepository implements SellerBankAccountRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: UpsertBankAccountInput): Promise<SellerBankAccount> {
    const row = await this.prisma.sellerBankAccount.upsert({
      where: { sellerId: input.sellerId },
      create: {
        id: input.id,
        sellerId: input.sellerId,
        accountHolder: input.accountHolder,
        last4: input.last4,
        encryptedRef: input.encryptedRef,
        country: input.country,
        currency: input.currency,
        ...(input.bankName !== undefined ? { bankName: input.bankName } : {}),
      },
      update: {
        accountHolder: input.accountHolder,
        last4: input.last4,
        encryptedRef: input.encryptedRef,
        country: input.country,
        currency: input.currency,
        bankName: input.bankName ?? null,
      },
    });
    return toDomainSellerBankAccount(row);
  }
}
