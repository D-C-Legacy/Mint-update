import {env} from './env';

export const databaseConfig = Object.freeze({
    url:env.DATABASE_URL,
});

export type DatabaseConfig = typeof databaseConfig;

