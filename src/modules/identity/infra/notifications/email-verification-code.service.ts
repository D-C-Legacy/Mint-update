import { Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { RedisService } from '../../../../platform/redis/redis.service';

const TTL_SECONDS = 15 * 60;
const KEY_PREFIX = 'email-verify-code:';
const MAX_ISSUE_ATTEMPTS = 5;

// Short, typeable replacement for the old JWT verification token (founder feedback 24 Oct 2026:
// "that token is so long we should keep short"). A 6-digit code has far less entropy than a JWT,
// so unlike `JwtService.signPurposeToken` it can't be stateless/self-verifying — it has to live in
// Redis (keyed by the code itself, not the user, since the client has no user id to send back) with
// a short TTL standing in for the security a longer token gets from sheer length.
@Injectable()
export class EmailVerificationCodeService {
  constructor(private readonly redis: RedisService) {}

  // SET NX is the collision guard: two pending signups could otherwise roll the same 6-digit code
  // and the second SET would silently steal the first user's code. Retrying a handful of times on
  // a 1-in-a-million collision is cheap insurance, not a real throughput concern at this volume.
  async issue(userId: string): Promise<string> {
    for (let attempt = 0; attempt < MAX_ISSUE_ATTEMPTS; attempt++) {
      const code = String(randomInt(100000, 1000000));
      const set = await this.redis.client.set(
        `${KEY_PREFIX}${code}`,
        userId,
        'EX',
        TTL_SECONDS,
        'NX',
      );
      if (set === 'OK') return code;
    }
    throw new Error('Could not issue a unique email verification code');
  }

  // One-time use: a hit deletes the key, so a leaked/retried code can't be replayed.
  async consume(code: string): Promise<string | null> {
    const key = `${KEY_PREFIX}${code}`;
    const userId = await this.redis.client.get(key);
    if (userId) await this.redis.client.del(key);
    return userId;
  }
}
