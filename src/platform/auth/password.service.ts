import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { authConfig } from '../../config/auth.config';

@Injectable()
export class PasswordService {
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: authConfig.argon2.memoryCost,
      timeCost: authConfig.argon2.timeCost,
      parallelism: authConfig.argon2.parallelism,
    });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
