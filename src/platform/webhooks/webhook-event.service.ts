import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { generateId } from '../../shared/ids/id';

export interface RecordWebhookEventInput {
  readonly provider: string;
  readonly providerEventId: string;
  readonly type: string;
  readonly payload: unknown;
}

export interface RecordWebhookEventResult {
  readonly id: string;
  readonly isNew: boolean;
}

// 05-API-SPEC.md §8's webhook-handling algorithm ("insert into WebhookEvent with providerEventId
// unique, a duplicate insert means already seen") is documented under Stripe but the schema itself
// (03-DATA-MODEL.md §9) is provider-agnostic (`provider: String`), so this lives in platform/ for
// reuse by any provider's webhook ingestion — streaming (P4-03) is first, Stripe (P6-06) is next.
@Injectable()
export class WebhookEventService {
  constructor(private readonly prisma: PrismaService) {}

  async recordIfNew(input: RecordWebhookEventInput): Promise<RecordWebhookEventResult> {
    const id = generateId();
    try {
      await this.prisma.webhookEvent.create({
        data: {
          id,
          provider: input.provider,
          providerEventId: input.providerEventId,
          type: input.type,
          payload: input.payload as Prisma.InputJsonValue,
        },
      });
      return { id, isNew: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.webhookEvent.findUniqueOrThrow({
          where: { providerEventId: input.providerEventId },
        });
        return { id: existing.id, isNew: false };
      }
      throw err;
    }
  }

  async markProcessed(id: string, error?: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id },
      data: { processedAt: new Date(), ...(error !== undefined ? { error } : {}) },
    });
  }

  // P9-04's "payment webhook lag" alert: a webhook stuck unprocessed longer than the threshold is
  // the actionable signal (a backed-up/broken processing job), not a webhook's own after-the-fact
  // processing duration once it already succeeded. Provider-agnostic, same as the rest of this
  // service — P9-04 only ever calls it for `provider: 'stripe'`, but nothing here assumes that.
  async countStaleUnprocessed(olderThanMs: number, provider?: string): Promise<number> {
    return this.prisma.webhookEvent.count({
      where: {
        processedAt: null,
        receivedAt: { lt: new Date(Date.now() - olderThanMs) },
        ...(provider !== undefined ? { provider } : {}),
      },
    });
  }
}
