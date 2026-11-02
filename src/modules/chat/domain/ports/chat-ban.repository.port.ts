export const CHAT_BAN_REPOSITORY = Symbol('ChatBanRepositoryPort');

export interface UpsertChatBanInput {
  readonly id: string;
  readonly channelId: string;
  readonly userId: string;
  readonly bannedByUserId: string;
  readonly reason: string | null;
  readonly expiresAt: Date | null;
}

export interface ChatBanRepositoryPort {
  /** Keyed on the schema's `@@unique([channelId, userId])` — re-banning an already-banned user
   * updates the existing row (new reason/expiry) rather than erroring. */
  upsert(input: UpsertChatBanInput): Promise<void>;
  delete(channelId: string, userId: string): Promise<void>;
}
