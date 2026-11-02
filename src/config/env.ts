import 'dotenv/config';
import { EnvSchema, type Env } from './env.schema';

function loadEnv(): Readonly<Env> {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return Object.freeze(result.data);
}

export const env = loadEnv();