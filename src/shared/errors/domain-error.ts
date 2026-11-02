import { ErrorCode } from './error-codes';

export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}
