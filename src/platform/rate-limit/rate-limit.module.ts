import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { TokenBucketService } from './token-bucket.service';
import { RateLimitService } from './rate-limit.service';
import { DefaultRateLimitGuard } from './default-rate-limit.guard';
import { WsDefaultRateLimitGuard } from './ws-default-rate-limit.guard';

@Module({
  imports: [RedisModule],
  providers: [TokenBucketService, RateLimitService, DefaultRateLimitGuard, WsDefaultRateLimitGuard],
  exports: [TokenBucketService, RateLimitService, DefaultRateLimitGuard, WsDefaultRateLimitGuard],
})
export class RateLimitModule {}
