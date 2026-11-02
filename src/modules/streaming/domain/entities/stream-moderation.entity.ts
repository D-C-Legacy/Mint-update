export type StreamModeratorRole = 'MODERATOR';
export type ChatTimeoutReason = 'SPAM' | 'HARASSMENT' | 'INAPPROPRIATE' | 'OTHER';

export interface StreamModerator {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly addedBy: string;
  readonly role: StreamModeratorRole;
  readonly createdAt: Date;
}

export interface ChatTimeout {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly moderatorId: string;
  readonly expiresAt: Date;
  readonly reason: ChatTimeoutReason;
  readonly createdAt: Date;
}
