import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import { User } from '../../domain/entities/user.entity';

export interface GetUserByIdCommand {
  readonly userId: string;
}

// Added for P8-04: notification handlers need a user's email address to resolve the EMAIL
// channel's recipient. `findById` already existed on the repository, just never exposed —
// same shape as P5-09's GetSellerByIdQuery.
@Injectable()
export class GetUserByIdQuery {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort) {}

  async execute(cmd: GetUserByIdCommand): Promise<User | null> {
    return this.users.findById(cmd.userId);
  }
}
