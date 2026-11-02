import { Injectable } from '@nestjs/common';
import { rateLimitConfig, RateLimitScope } from '../../config/rate-limit.config';
import { TokenBucketOutcome, TokenBucketService } from './token-bucket.service';

// Single call surface for every rate-limit check in this codebase (P9-01) — wraps
// TokenBucketService with the scope's capacity/refill looked up from rate-limit.config.ts, so
// call sites (use cases and the two default guards below) only ever name a scope + a key, never
// a raw capacity/refillPerSecond pair.
@Injectable()
export class RateLimitService {
  constructor(private readonly tokenBucket: TokenBucketService) {}

  async check(scope: RateLimitScope, key: string): Promise<TokenBucketOutcome> {
    const { capacity, refillPerSecond } = rateLimitConfig[scope];
    return this.tokenBucket.tryConsume(`ratelimit:${scope}:${key}`, capacity, refillPerSecond);
  }
}
