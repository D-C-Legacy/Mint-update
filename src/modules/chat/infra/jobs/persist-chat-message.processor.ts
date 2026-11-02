import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { redisConfig } from '../../../../config/redis.config';
import { QueueNames } from '../../../../platform/queue/queue.names';
import { wrapJobProcessor } from '../../../../platform/observability/job-wrapper';
import {
  CHAT_MESSAGE_REPOSITORY,
  ChatMessageRepositoryPort,
  UpsertChatMessageInput,
} from '../../domain/ports/chat-message.repository.port';

export const PERSIST_JOB_NAME = 'persist-message';

// 06-REALTIME-AND-CONCURRENCY.md §9: "Write to Postgres asynchronously via a queue. The broadcast
// does not wait on the insert." Same per-module Worker shape as P4-03's StreamReconcileProcessor
// (dedicated connection, not shared with QueueService's producer-only connection). Unlike
// reconcile, correctness here doesn't depend on exactly-once — the repository's `upsert` keyed on
// the message's own id makes a retried/duplicated job delivery a harmless no-op, and losing a
// chat message outright is explicitly an acceptable failure mode per the doc, unlike a bid.
@Injectable()
export class PersistChatMessageProcessor implements OnModuleDestroy {
  private readonly connection = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });
  private readonly worker = new Worker(
    QueueNames.CHAT,
    wrapJobProcessor(QueueNames.CHAT, async (job) => {
      if (job.name === PERSIST_JOB_NAME) {
        await this.messages.upsert(job.data as UpsertChatMessageInput);
      }
    }),
    { connection: this.connection },
  );

  constructor(@Inject(CHAT_MESSAGE_REPOSITORY) private readonly messages: ChatMessageRepositoryPort) {}

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }
}
