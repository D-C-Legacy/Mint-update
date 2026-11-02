import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import IORedis from 'ioredis';
import { redisConfig } from '../../config/redis.config';

type MessageHandler = (message: string) => void;

@Injectable()
export class PubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly publisher = new IORedis(redisConfig.url, { lazyConnect: true });
  private readonly subscriber = new IORedis(redisConfig.url, { lazyConnect: true });
  private readonly handlers = new Map<string, Set<MessageHandler>>();

  constructor() {
    // Attached here, once, not in onModuleInit. A WebSocket gateway's `afterInit` runs BEFORE
    // Nest's onModuleInit hooks and subscribes through this service, which makes ioredis start
    // connecting the subscriber (status leaves 'wait') — so the `status === 'wait'` guard in
    // onModuleInit was skipped and, when the listener lived inside it, it was never attached: Redis
    // counted the subscription but every message was silently dropped. That made every
    // cross-process event meant for a socket (a bid placed over HTTP reaching the realtime
    // process) vanish. Found in app integration Phase 5.
    this.subscriber.on('message', (channel: string, message: string) => {
      this.handlers.get(channel)?.forEach((handler) => handler(message));
    });
  }

  async onModuleInit(): Promise<void> {
    // Guarded rather than called unconditionally: with `lazyConnect: true`, ioredis throws
    // "already connecting/connected" if `.connect()` is called on a client not in its initial
    // 'wait' state. Found live in P4-06 once enough modules shared RedisModule concurrently for
    // this hook to run more than once on the same instance — see MEMORY.md for the investigation.
    if (this.publisher.status === 'wait') {
      await this.publisher.connect();
    }
    if (this.subscriber.status === 'wait') {
      await this.subscriber.connect();
    }
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.publisher.publish(channel, message);
  }

  async subscribe(channel: string, handler: MessageHandler): Promise<void> {
    let set = this.handlers.get(channel);
    if (!set) {
      set = new Set();
      this.handlers.set(channel, set);
      await this.subscriber.subscribe(channel);
    }
    set.add(handler);
  }

  async unsubscribe(channel: string, handler: MessageHandler): Promise<void> {
    const set = this.handlers.get(channel);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      this.handlers.delete(channel);
      await this.subscriber.unsubscribe(channel);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
  }
}
