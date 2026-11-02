import { UserPreferences, UserPreferencesPatch } from '../entities/user-preferences.entity';

export const USER_PREFERENCES_REPOSITORY = Symbol('UserPreferencesRepositoryPort');

export interface UserPreferencesRepositoryPort {
  // Returns null when the user has never saved anything (callers fall back to the defaults).
  findByUserId(userId: string): Promise<UserPreferences | null>;
  // Creates the row if missing and writes only the fields present in the patch, so two quick
  // toggles from the same client cannot overwrite each other.
  upsert(userId: string, patch: UserPreferencesPatch): Promise<UserPreferences>;
}
