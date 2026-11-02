import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { RedisService } from '../../../../platform/redis/redis.service';
import { AuthResult } from '../../application/commands/login.usecase';

const TTL_SECONDS = 60;
const KEY_PREFIX = 'oauth-exchange-code:';

// A web OAuth sign-in finishes with the browser being redirected back from Google/Apple — real
// access/refresh tokens can't safely ride along in that redirect's query string (browser
// history, Referer headers, server logs). Instead the backend computes the real AuthResult,
// stores it here behind a short-lived, single-use, unguessable code (same SET-NX-then-GET-and-
// DELETE idiom as EmailVerificationCodeService, just keyed by a random code instead of a 6-digit
// one since this is a URL param, not something a person types), and redirects with only that
// code. The frontend's one job is POST /auth/exchange-code with it.
@Injectable()
export class OAuthExchangeCodeService {
  constructor(private readonly redis: RedisService) {}

  async issue(result: AuthResult): Promise<string> {
    const code = randomBytes(32).toString('hex');
    await this.redis.client.set(
      `${KEY_PREFIX}${code}`,
      JSON.stringify(result),
      'EX',
      TTL_SECONDS,
      'NX',
    );
    return code;
  }

  // One-time use: a hit deletes the key, so a leaked/retried code can't be replayed.
  async consume(code: string): Promise<AuthResult | null> {
    const key = `${KEY_PREFIX}${code}`;
    const stored = await this.redis.client.get(key);
    if (!stored) return null;
    await this.redis.client.del(key);
    return JSON.parse(stored) as AuthResult;
  }
}
