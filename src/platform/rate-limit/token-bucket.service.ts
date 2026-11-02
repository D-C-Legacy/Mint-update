import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

// Standard token-bucket algorithm, atomic via a single Lua script (read-refill-check-decrement
// has to happen as one step, or two concurrent requests could both read "1 token left" and both
// be allowed). Tokens refill continuously based on elapsed wall-clock time since the last check,
// capped at `capacity` (the burst allowance).
//
// Built in P4-06 for chat.send (06-REALTIME-AND-CONCURRENCY.md §9: "Rate limit 3 messages/sec per
// user via Redis token bucket") — the first rate limiter in this codebase. Generalized in P9-01
// ("Rate limiting everywhere", 05-API-SPEC.md §13) to serve every other documented scope, several
// of which have windows measured in minutes/hours, not seconds.
//
// Returns `retryAfterSeconds` alongside `allowed` so callers (both HTTP, for a `Retry-After`
// header, and WS, for the rejection payload) can tell the caller how long to wait — the seconds
// needed for the bucket to refill the 1 token this call needed but didn't have.
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillPerSecond = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(bucket[1])
local ts = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  ts = now
end

local elapsedMs = math.max(0, now - ts)
local refill = (elapsedMs / 1000) * refillPerSecond
tokens = math.min(capacity, tokens + refill)

local allowed = 0
local retryAfterSeconds = 0
if tokens >= 1 then
  allowed = 1
  tokens = tokens - 1
else
  retryAfterSeconds = math.ceil((1 - tokens) / refillPerSecond)
end

redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', key, ARGV[4])

return { allowed, retryAfterSeconds }
`;

export interface TokenBucketOutcome {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

@Injectable()
export class TokenBucketService {
  constructor(private readonly redis: RedisService) {}

  async tryConsume(key: string, capacity: number, refillPerSecond: number): Promise<TokenBucketOutcome> {
    // The key's TTL must outlive a full empty-to-capacity refill, or a caller spaced further
    // apart than the TTL finds the key already expired and gets a fresh, full bucket every time
    // — silently defeating any limit whose window is longer than a couple of seconds (every scope
    // in 05-API-SPEC.md §13 except bid/chat/offer). +1000ms buffer against clock/scheduling jitter.
    const ttlMs = Math.ceil((capacity / refillPerSecond) * 1000) + 1000;

    const [allowed, retryAfterSeconds] = (await this.redis.client.eval(
      TOKEN_BUCKET_SCRIPT,
      1,
      key,
      capacity,
      refillPerSecond,
      Date.now(),
      ttlMs,
    )) as [number, number];

    return { allowed: allowed === 1, retryAfterSeconds };
  }
}
