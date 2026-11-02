import { DomainError } from '../../../../shared/errors/domain-error';
import { ErrorCodes } from '../../../../shared/errors/error-codes';
import { SellerStatus } from '../entities/seller.entity';

export class SellerApplicationNotFoundError extends DomainError {
  readonly code = ErrorCodes.SELLER_APPLICATION_NOT_FOUND;

  constructor(context: string) {
    super(`No seller application found for ${context}`);
  }
}

export class InvalidSellerStatusError extends DomainError {
  readonly code = ErrorCodes.INVALID_SELLER_STATUS;

  constructor(action: string, expected: SellerStatus, actual: SellerStatus) {
    super(`Cannot ${action}: expected status ${expected}, got ${actual}`, { expected, actual });
  }
}

export class SellerDocumentNotFoundError extends DomainError {
  readonly code = ErrorCodes.SELLER_DOCUMENT_NOT_FOUND;

  constructor(documentId: string) {
    super(`No seller document found: ${documentId}`);
  }
}

export class SellerTeamMemberNotFoundError extends DomainError {
  readonly code = ErrorCodes.NOT_FOUND;

  constructor(memberId: string) {
    super(`No seller team member found: ${memberId}`);
  }
}

export class SellerTeamMemberAlreadyExistsError extends DomainError {
  readonly code = ErrorCodes.CONFLICT;

  constructor(sellerId: string, userId: string) {
    super(`User ${userId} is already a member of seller ${sellerId}`);
  }
}

export class CannotRemoveOwnerError extends DomainError {
  readonly code = ErrorCodes.FORBIDDEN;

  constructor() {
    super('Cannot remove the owner from the team');
  }
}

export class CannotDemoteOwnerError extends DomainError {
  readonly code = ErrorCodes.FORBIDDEN;

  constructor() {
    super('Cannot change the owner role');
  }
}

export class InsufficientTeamRoleError extends DomainError {
  readonly code = ErrorCodes.FORBIDDEN;

  constructor(required: string, actual: string) {
    super(`Requires ${required} role, got ${actual}`, { required, actual });
  }
}

export class SellerInvitationNotFoundError extends DomainError {
  readonly code = ErrorCodes.NOT_FOUND;

  constructor(invitationId: string) {
    super(`No seller invitation found: ${invitationId}`);
  }
}

export class SellerInvitationExpiredError extends DomainError {
  readonly code = ErrorCodes.CONFLICT;

  constructor() {
    super('Invitation has expired');
  }
}

export class SellerInvitationAlreadyAcceptedError extends DomainError {
  readonly code = ErrorCodes.CONFLICT;

  constructor() {
    super('Invitation has already been accepted');
  }
}

export class SellerInvitationCancelledError extends DomainError {
  readonly code = ErrorCodes.CONFLICT;

  constructor() {
    super('Invitation has been cancelled');
  }
}

export class SellerInvitationAlreadyExistsError extends DomainError {
  readonly code = ErrorCodes.CONFLICT;

  constructor(sellerId: string, email: string) {
    super(`Pending invitation already exists for ${email} on seller ${sellerId}`);
  }
}

export class CannotInviteSelfError extends DomainError {
  readonly code = ErrorCodes.VALIDATION_ERROR;

  constructor() {
    super('Cannot invite yourself');
  }
}

// 05-API-SPEC.md §13: "Upload URL requests: 20/min per user" — seller-document upload-url
// requests. Declared locally, not reused from catalog's own UploadRateLimitedError, for the same
// cross-module-boundary reason every other mirrored error in this codebase is duplicated.
export class UploadRateLimitedError extends DomainError {
  readonly code = ErrorCodes.RATE_LIMITED;

  constructor(retryAfterSeconds: number) {
    super('Upload URL rate limit exceeded: 20/min per user', { retryAfterSeconds });
  }
}

// The client sent a storage key that wasn't minted for this user. Generic VALIDATION_ERROR (no
// registry change) — a malformed request, not a domain state. A document key is only ever minted by
// RequestDocumentUploadUseCase under the caller's own userId prefix.
export class InvalidStorageKeyError extends DomainError {
  readonly code = ErrorCodes.VALIDATION_ERROR;

  constructor(userId: string) {
    super(`Storage key is not valid for user ${userId}`);
  }
}
