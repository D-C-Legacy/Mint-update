import {
  StreamModerator,
  StreamModeratorRole,
  ChatTimeout,
  ChatTimeoutReason,
} from '../entities/stream-moderation.entity';

export const STREAM_MODERATOR_REPOSITORY = Symbol('StreamModeratorRepositoryPort');
export const CHAT_TIMEOUT_REPOSITORY = Symbol('ChatTimeoutRepositoryPort');

export interface CreateModeratorInput {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly addedBy: string;
  readonly role: StreamModeratorRole;
}

export interface ListModeratorsFilter {
  readonly sessionId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface StreamModeratorRepositoryPort {
  findById(id: string): Promise<StreamModerator | null>;
  findBySessionIdAndUserId(sessionId: string, userId: string): Promise<StreamModerator | null>;
  findByUserId(userId: string): Promise<StreamModerator[]>;
  create(input: CreateModeratorInput): Promise<StreamModerator>;
  delete(moderatorId: string): Promise<void>;
  list(filter: ListModeratorsFilter): Promise<StreamModerator[]>;
}

export interface CreateTimeoutInput {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly moderatorId: string;
  readonly expiresAt: Date;
  readonly reason: ChatTimeoutReason;
}

export interface ListTimeoutsFilter {
  readonly sessionId: string;
  readonly userId: string | undefined;
  readonly activeOnly: boolean | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface ChatTimeoutRepositoryPort {
  findById(id: string): Promise<ChatTimeout | null>;
  findActiveBySessionIdAndUserId(sessionId: string, userId: string): Promise<ChatTimeout | null>;
  create(input: CreateTimeoutInput): Promise<ChatTimeout>;
  delete(expiredBefore: Date): Promise<number>; // bulk delete expired
  list(filter: ListTimeoutsFilter): Promise<ChatTimeout[]>;
}
