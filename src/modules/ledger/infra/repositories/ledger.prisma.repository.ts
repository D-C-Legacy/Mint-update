import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  CreateAccountInput,
  CreateTransactionInput,
  CreateTransactionOutcome,
  LedgerRepositoryPort,
  ListSellerEntriesFilter,
} from '../../domain/ports/ledger.repository.port';
import { LedgerAccount, LedgerAccountType } from '../../domain/entities/ledger-account.entity';
import { LedgerTransaction } from '../../domain/entities/ledger-transaction.entity';
import { SellerBalance, SellerBalanceAmounts } from '../../domain/entities/seller-balance.entity';
import { SellerLedgerEntry } from '../../domain/entities/seller-ledger-entry.entity';
import { toDomainLedgerAccount } from '../mappers/ledger-account.mapper';
import { toDomainLedgerTransaction } from '../mappers/ledger-transaction.mapper';
import { toDomainSellerBalance } from '../mappers/seller-balance.mapper';

const SELLER_ACCOUNT_TYPES: readonly LedgerAccountType[] = ['SELLER_PENDING', 'SELLER_AVAILABLE', 'SELLER_PAID_OUT'];

@Injectable()
export class LedgerPrismaRepository implements LedgerRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAccount(type: LedgerAccountType, ownerId: string | null, currency: string): Promise<LedgerAccount | null> {
    const row = await this.prisma.ledgerAccount.findFirst({ where: { type, ownerId, currency } });
    return row ? toDomainLedgerAccount(row) : null;
  }

  // Same "fetch-and-return-existing" shape as P3-04's channel-slug collision / P6-07's
  // Payment.orderId race — a genuine concurrent caller creating the same not-yet-existing
  // account wins or loses the P2002, never errors the loser out.
  async createAccount(input: CreateAccountInput): Promise<LedgerAccount> {
    try {
      const row = await this.prisma.ledgerAccount.create({
        data: { id: input.id, type: input.type, ownerId: input.ownerId, currency: input.currency },
      });
      return toDomainLedgerAccount(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.findAccount(input.type, input.ownerId, input.currency);
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  async findTransactionByIdempotencyKey(idempotencyKey: string): Promise<LedgerTransaction | null> {
    const row = await this.prisma.ledgerTransaction.findUnique({ where: { idempotencyKey }, include: { entries: true } });
    return row ? toDomainLedgerTransaction(row) : null;
  }

  // One Prisma nested-write call — `entries: { create: [...] }` is already atomic in a single
  // round trip (Prisma's implicit transaction for nested writes), no `TransactionManager`
  // needed (same "prefer Prisma nested writes" precedent as P2-03's Seller+SellerApplication
  // aggregate). `idempotencyKey`'s `@unique` constraint is what makes a genuine concurrent
  // replay land exactly once — the loser's P2002 is resolved to the WINNING row here, not
  // thrown.
  async createTransaction(input: CreateTransactionInput): Promise<CreateTransactionOutcome> {
    try {
      const row = await this.prisma.ledgerTransaction.create({
        data: {
          id: input.id,
          type: input.type,
          idempotencyKey: input.idempotencyKey,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          description: input.description ?? null,
          entries: {
            create: input.entries.map((entry) => ({
              id: entry.id,
              accountId: entry.accountId,
              direction: entry.direction,
              amount: entry.amount,
              currency: entry.currency,
            })),
          },
        },
        include: { entries: true },
      });
      return { transaction: toDomainLedgerTransaction(row), created: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.findTransactionByIdempotencyKey(input.idempotencyKey);
        if (existing) {
          return { transaction: existing, created: false };
        }
      }
      throw err;
    }
  }

  async findSellerBalance(sellerId: string): Promise<SellerBalance | null> {
    const row = await this.prisma.sellerBalance.findUnique({ where: { sellerId } });
    return row ? toDomainSellerBalance(row) : null;
  }

  // A single atomic `UPDATE ... SET x = x + delta` (Prisma's `increment`) when the row already
  // exists, or a fresh row seeded at exactly `delta` otherwise — safe under concurrent posts
  // touching the same seller's balance without any explicit lock, same reasoning as every other
  // Postgres-native atomic-UPDATE guard in this codebase (P3-03's stock reservation).
  async incrementSellerBalance(
    sellerId: string,
    currency: string,
    delta: SellerBalanceAmounts,
    lastEntryId: string | null,
  ): Promise<SellerBalance> {
    const row = await this.prisma.sellerBalance.upsert({
      where: { sellerId },
      create: {
        sellerId,
        currency,
        pendingAmount: delta.pendingAmount,
        availableAmount: delta.availableAmount,
        paidOutAmount: delta.paidOutAmount,
        lastEntryId,
      },
      update: {
        pendingAmount: { increment: delta.pendingAmount },
        availableAmount: { increment: delta.availableAmount },
        paidOutAmount: { increment: delta.paidOutAmount },
        lastEntryId,
      },
    });
    return toDomainSellerBalance(row);
  }

  async replaceSellerBalance(
    sellerId: string,
    currency: string,
    amounts: SellerBalanceAmounts,
    lastEntryId: string | null,
  ): Promise<SellerBalance> {
    const row = await this.prisma.sellerBalance.upsert({
      where: { sellerId },
      create: { sellerId, currency, ...amounts, lastEntryId },
      update: { currency, ...amounts, lastEntryId },
    });
    return toDomainSellerBalance(row);
  }

  // Prisma's query builder can't group by a related model's field (LedgerAccount.type) in one
  // call, so this is scoped to a single account per call — rebuildBalance() calls it 3 times
  // (once per seller-owned account type) and P7-08's reconciliation job calls it once for
  // PLATFORM_CASH, rather than one query grouped every way at once.
  async sumAccountEntries(ownerId: string | null, currency: string, type: LedgerAccountType): Promise<bigint> {
    const rows = await this.prisma.ledgerEntry.groupBy({
      by: ['direction'],
      where: { currency, account: { ownerId, type } },
      _sum: { amount: true },
    });
    const credit = rows.find((r) => r.direction === 'CREDIT')?._sum.amount ?? 0n;
    const debit = rows.find((r) => r.direction === 'DEBIT')?._sum.amount ?? 0n;
    return credit - debit;
  }

  async findLatestSellerEntryId(sellerId: string, currency: string): Promise<string | null> {
    const row = await this.prisma.ledgerEntry.findFirst({
      where: { currency, account: { ownerId: sellerId, type: { in: [...SELLER_ACCOUNT_TYPES] } } },
      orderBy: { createdAt: 'desc' },
    });
    return row?.id ?? null;
  }

  async findSellersWithPositiveAvailableBalance(currency: string): Promise<readonly string[]> {
    const rows = await this.prisma.sellerBalance.findMany({
      where: { currency, availableAmount: { gt: 0n } },
      select: { sellerId: true },
    });
    return rows.map((row) => row.sellerId);
  }

  async findDeliveredOrderCredits(
    sellerId: string,
    currency: string,
  ): Promise<ReadonlyArray<{ orderId: string; amount: bigint }>> {
    const rows = await this.prisma.ledgerEntry.findMany({
      where: {
        currency,
        direction: 'CREDIT',
        account: { ownerId: sellerId, type: 'SELLER_AVAILABLE' },
        transaction: { type: 'order.delivered', referenceType: 'order' },
      },
      include: { transaction: { select: { referenceId: true } } },
    });
    return rows.map((row) => ({ orderId: row.transaction.referenceId, amount: row.amount }));
  }

  // Prisma's query builder can't express a per-row CASE-WHEN inside a SUM, so this is raw SQL —
  // same "go straight to $queryRaw" precedent as P3-03's stock-reservation UPDATE. Read-only,
  // no user input is interpolated (nothing here is parameterized by request data), so this is
  // safe as a plain tagged-template query.
  async findUnbalancedTransactionIds(): Promise<readonly string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ transactionId: string }>>`
      SELECT "transactionId"
      FROM "LedgerEntry"
      GROUP BY "transactionId"
      HAVING SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE -amount END) != 0
    `;
    return rows.map((row) => row.transactionId);
  }

  async findSellerIdsWithBalance(): Promise<readonly string[]> {
    const rows = await this.prisma.sellerBalance.findMany({ select: { sellerId: true } });
    return rows.map((row) => row.sellerId);
  }

  async findEntriesForSeller(filter: ListSellerEntriesFilter): Promise<SellerLedgerEntry[]> {
    const rows = await this.prisma.ledgerEntry.findMany({
      where: {
        currency: filter.currency,
        account: { ownerId: filter.sellerId, type: { in: [...SELLER_ACCOUNT_TYPES] } },
      },
      include: {
        account: { select: { type: true } },
        transaction: { select: { type: true, referenceType: true, referenceId: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map((row) => ({
      id: row.id,
      transactionType: row.transaction.type,
      referenceType: row.transaction.referenceType,
      referenceId: row.transaction.referenceId,
      accountType: row.account.type,
      direction: row.direction,
      amount: row.amount,
      currency: row.currency,
      createdAt: row.createdAt,
    }));
  }
}
