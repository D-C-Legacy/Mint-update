import {env} from './env';

export const redisConfig = Object.freeze({
    url:env.REDIS_URL,
});

export type RedisConfig = typeof redisConfig;