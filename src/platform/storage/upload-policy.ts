import { Result, Ok, Err } from '../../shared/result/result';
import { DomainError } from '../../shared/errors/domain-error';
import { ErrorCodes } from '../../shared/errors/error-codes';

// Server-side guard on the upload a client *declared* to a presigned-URL endpoint. S3 enforces the
// signed Content-Type on the PUT itself (a mismatched body is rejected as a signature failure), but
// nothing else: a client could still declare an unexpected type or an absurd size. Each upload use
// case checks these before issuing a URL.
//
// Returns a Result rather than throwing: every use case in this codebase returns Results, and the
// GlobalExceptionFilter only translates HttpExceptions — a thrown DomainError would become a bare
// 500. Callers fold this into their own error union.
export class InvalidUploadError extends DomainError {
  readonly code = ErrorCodes.INVALID_UPLOAD;

  constructor(reason: string) {
    super(`Upload not allowed: ${reason}`, { reason });
  }
}

// Product/channel/avatar photos and seller documents. HEIC/HEIF included because iOS cameras and
// expo-image-picker return them by default; S3 stores the declared type and the app renders via
// <Image>, which handles them on both platforms.
export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;
export const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

function isAllowed(mimeTypes: readonly string[], mimeType: string): boolean {
  return mimeTypes.includes(mimeType);
}

export function assertImageUpload(
  mimeType: string,
  sizeBytes: number,
): Result<void, InvalidUploadError> {
  if (!isAllowed(IMAGE_MIME_TYPES, mimeType)) {
    return Err(new InvalidUploadError(`unsupported image type "${mimeType}"`));
  }
  if (sizeBytes > MAX_IMAGE_BYTES) {
    return Err(new InvalidUploadError('image exceeds the 10 MB limit'));
  }
  return Ok(undefined);
}

export function assertDocumentUpload(
  mimeType: string,
  sizeBytes: number,
): Result<void, InvalidUploadError> {
  if (!isAllowed(DOCUMENT_MIME_TYPES, mimeType)) {
    return Err(new InvalidUploadError(`unsupported document type "${mimeType}"`));
  }
  if (sizeBytes > MAX_DOCUMENT_BYTES) {
    return Err(new InvalidUploadError('document exceeds the 10 MB limit'));
  }
  return Ok(undefined);
}
