import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import IORedis from 'ioredis';
import { redisConfig } from '../../config/redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client = new IORedis(redisConfig.url, { lazyConnect: true });

  async onModuleInit(): Promise<void> {
    // Guarded for the same reason as PubSubService's own onModuleInit: with `lazyConnect: true`,
    // ioredis throws "already connecting/connected" if `.connect()` runs on a client not in its
    // initial 'wait' state — reachable once enough modules share RedisModule concurrently for
    // this hook to fire more than once on the same singleton instance (see that file's comment).
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
