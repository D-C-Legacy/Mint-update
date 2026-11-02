import { Inject, Injectable } from '@nestjs/common';
import {
  USER_PREFERENCES_REPOSITORY,
  UserPreferencesRepositoryPort,
} from '../../domain/ports/user-preferences.repository.port';
import { DEFAULT_USER_PREFERENCES, UserPreferences } from '../../domain/entities/user-preferences.entity';

export interface GetPreferencesCommand {
  readonly userId: string;
}

@Injectable()
export class GetPreferencesUseCase {
  constructor(@Inject(USER_PREFERENCES_REPOSITORY) private readonly preferences: UserPreferencesRepositoryPort) {}

  async execute(cmd: GetPreferencesCommand): Promise<UserPreferences> {
    return (await this.preferences.findByUserId(cmd.userId)) ?? DEFAULT_USER_PREFERENCES;
  }
}
