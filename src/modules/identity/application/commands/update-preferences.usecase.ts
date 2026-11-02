import { Inject, Injectable } from '@nestjs/common';
import {
  USER_PREFERENCES_REPOSITORY,
  UserPreferencesRepositoryPort,
} from '../../domain/ports/user-preferences.repository.port';
import { UserPreferences, UserPreferencesPatch } from '../../domain/entities/user-preferences.entity';

export interface UpdatePreferencesCommand {
  readonly userId: string;
  readonly patch: UserPreferencesPatch;
}

@Injectable()
export class UpdatePreferencesUseCase {
  constructor(@Inject(USER_PREFERENCES_REPOSITORY) private readonly preferences: UserPreferencesRepositoryPort) {}

  async execute(cmd: UpdatePreferencesCommand): Promise<UserPreferences> {
    return this.preferences.upsert(cmd.userId, cmd.patch);
  }
}
