export interface NotificationPreferences {
  readonly live: boolean;
  readonly bids: boolean;
  readonly orders: boolean;
  readonly messages: boolean;
}

export interface PrivacyPreferences {
  readonly publicProfile: boolean;
  readonly showActivity: boolean;
  readonly onlineStatus: boolean;
}

export interface UserPreferences {
  readonly notifications: NotificationPreferences;
  readonly privacy: PrivacyPreferences;
}

type PatchOf<T> = { readonly [K in keyof T]?: T[K] | undefined };

export interface UserPreferencesPatch {
  readonly notifications?: PatchOf<NotificationPreferences> | undefined;
  readonly privacy?: PatchOf<PrivacyPreferences> | undefined;
}

// What a user with no stored row sees. Matches the Prisma column defaults and the app's old mock.
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  notifications: { live: true, bids: true, orders: true, messages: true },
  privacy: { publicProfile: true, showActivity: false, onlineStatus: true },
};
