import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { PubSubService } from './pubsub.service';
import { LockService } from './lock.service';

@Module({
  providers: [RedisService, PubSubService, LockService],
  exports: [RedisService, PubSubService, LockService],
})
export class RedisModule {}
