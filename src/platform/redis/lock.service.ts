import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from './redis.service';

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export interface Lock {
  readonly key: string;
  readonly token: string;
}

@Injectable()
export class LockService {
  constructor(private readonly redis: RedisService) {}

  async acquire(key: string, ttlMs: number): Promise<Lock | null> {
    const token = randomUUID();
    const result = await this.redis.client.set(key, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? { key, token } : null;
  }

  async release(lock: Lock): Promise<void> {
    await this.redis.client.eval(RELEASE_SCRIPT, 1, lock.key, lock.token);
  }
}
