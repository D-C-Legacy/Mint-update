import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';

export class ChatMessageNotFoundError extends DomainError {
  readonly code = ErrorCodes.CHAT_MESSAGE_NOT_FOUND;

  constructor(messageId: string) {
    super(`No chat message found: ${messageId}`);
  }
}

export class UserBannedError extends DomainError {
  readonly code = ErrorCodes.CHAT_USER_BANNED;

  constructor() {
    super('User is banned from chat in this channel');
  }
}

export class ChatRateLimitedError extends DomainError {
  readonly code = ErrorCodes.RATE_LIMITED;

  constructor(retryAfterSeconds: number) {
    super('Chat rate limit exceeded: 3 messages/sec per user', { retryAfterSeconds });
  }
}

// Mirrors modules/streaming's own StreamSessionNotFoundError/StreamNotLiveError (same shared
// error codes, so the same HTTP status), declared locally: chat cannot import
// modules/streaming/domain/** across the module boundary, only StreamingService
// (application/*.service.ts) — same pattern as catalog's/channels' SellerProfileNotFoundError.
export class StreamSessionNotFoundError extends DomainError {
  readonly code = ErrorCodes.STREAM_SESSION_NOT_FOUND;

  constructor(sessionId: string) {
    super(`No stream session found: ${sessionId}`);
  }
}

export class StreamNotLiveError extends DomainError {
  readonly code = ErrorCodes.STREAM_NOT_LIVE;

  constructor(sessionId: string) {
    super(`Stream session ${sessionId} is not live`);
  }
}
