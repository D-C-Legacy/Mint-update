import type { LedgerAccount as PrismaLedgerAccount } from '@prisma/client';
import { LedgerAccount } from '../../domain/entities/ledger-account.entity';

export function toDomainLedgerAccount(row: PrismaLedgerAccount): LedgerAccount {
  return {
    id: row.id,
    type: row.type,
    ownerId: row.ownerId,
    currency: row.currency,
    createdAt: row.createdAt,
  };
}
