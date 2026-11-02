import type { LedgerTransaction as PrismaLedgerTransaction, LedgerEntry as PrismaLedgerEntry } from '@prisma/client';
import { LedgerTransaction } from '../../domain/entities/ledger-transaction.entity';

type TransactionWithEntries = PrismaLedgerTransaction & { entries: PrismaLedgerEntry[] };

export function toDomainLedgerTransaction(row: TransactionWithEntries): LedgerTransaction {
  return {
    id: row.id,
    type: row.type,
    idempotencyKey: row.idempotencyKey,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    description: row.description,
    createdAt: row.createdAt,
    entries: row.entries.map((entry) => ({
      id: entry.id,
      transactionId: entry.transactionId,
      accountId: entry.accountId,
      direction: entry.direction,
      amount: entry.amount,
      currency: entry.currency,
      createdAt: entry.createdAt,
    })),
  };
}
