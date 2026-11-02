import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class TransactionManager {
  constructor(private readonly prisma: PrismaService) {}

  // Prisma's defaults (maxWait: 2000ms, timeout: 5000ms) are tuned for isolated transactions,
  // not ones that legitimately queue behind a row lock under real burst concurrency — found
  // live in P5-06's 50-simultaneous-bid test, where later-queued transactions failed with
  // P2028 "Unable to start a transaction in the given time" despite the lock itself resolving
  // correctly. Bumped for every caller, not just sales — any future bulk-contention path (e.g.
  // ledger postings) would hit the same ceiling.
  async run<T>(work: (trx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((trx: TransactionClient) => work(trx), { maxWait: 10_000, timeout: 10_000 });
  }
}
