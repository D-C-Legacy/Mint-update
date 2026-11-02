import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';
import { StreamStatus } from '../entities/stream-session.entity';

export class StreamSessionNotFoundError extends DomainError {
  readonly code = ErrorCodes.STREAM_SESSION_NOT_FOUND;

  constructor(identifier: string) {
    super(`No stream session found: ${identifier}`);
  }
}

// Widened in P8-06 to a list of valid origin statuses, same treatment orders' own
// InvalidOrderStatusError already got for CANCEL/REFUND/DISPUTE — KILL (admin force-end) is the
// first streaming action legally reachable from more than one status (SCHEDULED or LIVE).
export class InvalidStreamStatusError extends DomainError {
  readonly code = ErrorCodes.INVALID_STREAM_STATUS;

  constructor(action: string, expected: readonly StreamStatus[], actual: StreamStatus) {
    const expectedLabel = expected.length === 1 ? expected[0] : `one of ${expected.join(', ')}`;
    super(`Cannot ${action}: expected status ${expectedLabel}, got ${actual}`, {
      expected,
      actual,
    });
  }
}

// Mirrors modules/sellers' SellerApplicationNotFoundError (same shared error code, so the same
// HTTP status), declared locally: streaming cannot import modules/sellers/domain/** across the
// module boundary, only SellersService (application/*.service.ts). Same pattern as catalog's
// and channels' own SellerProfileNotFoundError.
export class SellerProfileNotFoundError extends DomainError {
  readonly code = ErrorCodes.SELLER_APPLICATION_NOT_FOUND;

  constructor(userId: string) {
    super(`No seller profile found for user: ${userId}`);
  }
}

export class SellerNotApprovedError extends DomainError {
  readonly code = ErrorCodes.SELLER_NOT_APPROVED;

  constructor() {
    super('Seller must be approved before going live');
  }
}

// Mirrors modules/channels' ChannelNotFoundError, declared locally for the same cross-module-
// boundary reason as SellerProfileNotFoundError above.
export class ChannelNotFoundError extends DomainError {
  readonly code = ErrorCodes.CHANNEL_NOT_FOUND;

  constructor(identifier: string) {
    super(`No channel found: ${identifier}`);
  }
}

// Not a status *transition* (nothing changes), so it doesn't go through
// stream-status-transition.rule.ts — this is the "can a viewer join right now" read-side guard
// used by the WS gateway's room.join handler (P4-04).
export class StreamNotLiveError extends DomainError {
  readonly code = ErrorCodes.STREAM_NOT_LIVE;

  constructor(sessionId: string) {
    super(`Stream session ${sessionId} is not live`);
  }
}

// New with the live-streaming build-out, 14 Oct 2026 (founder_requests.md §2's queue).
export class QueueItemNotFoundError extends DomainError {
  readonly code = ErrorCodes.QUEUE_ITEM_NOT_FOUND;

  constructor(identifier: string) {
    super(`No queue item found: ${identifier}`);
  }
}

// "Spin the wheel" (21 Oct 2026) has nothing to randomly pick from.
export class NoPendingQueueItemsError extends DomainError {
  readonly code = ErrorCodes.NO_PENDING_QUEUE_ITEMS;

  constructor(sessionId: string) {
    super(`No pending queue items to spin for session: ${sessionId}`);
  }
}

// Stream moderation (Phase B)
export class StreamModeratorNotFoundError extends DomainError {
  readonly code = ErrorCodes.NOT_FOUND;

  constructor(identifier: string) {
    super(`No stream moderator found: ${identifier}`);
  }
}

export class StreamModeratorAlreadyExistsError extends DomainError {
  readonly code = ErrorCodes.CONFLICT;

  constructor(sessionId: string, userId: string) {
    super(`User ${userId} is already a moderator for session ${sessionId}`);
  }
}

export class CannotModerateSelfError extends DomainError {
  readonly code = ErrorCodes.FORBIDDEN;

  constructor() {
    super('Cannot moderate yourself');
  }
}

export class InsufficientStreamRoleError extends DomainError {
  readonly code = ErrorCodes.FORBIDDEN;

  constructor(required: string, actual: string) {
    super(`Requires ${required} role, got ${actual}`, { required, actual });
  }
}

export class ChatTimeoutNotFoundError extends DomainError {
  readonly code = ErrorCodes.NOT_FOUND;

  constructor(identifier: string) {
    super(`No chat timeout found: ${identifier}`);
  }
}

export class UserAlreadyTimedOutError extends DomainError {
  readonly code = ErrorCodes.CONFLICT;

  constructor() {
    super('User is already timed out');
  }
}
