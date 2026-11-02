import { ApiError, ErrorCodes } from './client';

const MESSAGES: Partial<Record<string, string>> = {
  [ErrorCodes.INVALID_CREDENTIALS]: 'Email or password is incorrect.',
  [ErrorCodes.EMAIL_ALREADY_REGISTERED]: 'An account with this email already exists.',
  [ErrorCodes.INVALID_TOKEN]: 'That token is invalid or has expired.',
  [ErrorCodes.CURRENT_PASSWORD_INCORRECT]: 'Your current password is incorrect.',
  [ErrorCodes.ADDRESS_LIMIT_REACHED]: 'You can save up to 10 addresses. Delete one to add another.',
  [ErrorCodes.NOT_FOUND]: 'That item could not be found. It may have been removed.',
  INVALID_ORDER_STATUS: 'This order can no longer be changed.',
  [ErrorCodes.RATE_LIMITED]: 'Too many attempts. Wait a moment and try again.',
  [ErrorCodes.VALIDATION_ERROR]: 'Some details were rejected. Check the form and try again.',
  [ErrorCodes.NETWORK_ERROR]: "Can't reach the server. Check that the API is running.",
  // Sales and bidding (05-API-SPEC.md §7)
  SALE_NOT_FOUND: 'This sale could not be found.',
  SALE_NOT_OPEN: 'This sale is not open for bids right now.',
  SALE_ENDED: 'This sale has already ended.',
  BID_BY_SELLER: "You can't bid on your own item.",
  BIDDER_ALREADY_LEADING: 'You are already the highest bidder.',
  BID_RATE_LIMITED: 'You are bidding too quickly. Wait a moment and try again.',
  OUT_OF_STOCK: 'This item just sold out.',
  OFFER_EXPIRED: 'This offer has expired.',
  PRODUCT_NOT_FOUND: 'This product is no longer available.',
  // Seller side (05-API-SPEC.md §3, §10)
  SELLER_APPLICATION_NOT_FOUND: "You haven't applied to sell yet.",
  SELLER_NOT_APPROVED: 'Your seller account needs to be approved first.',
  INVALID_SELLER_STATUS: "That can't be done at your account's current status.",
  SELLER_DOCUMENT_NOT_FOUND: 'That document could not be found.',
  CATEGORY_NOT_FOUND: 'That category could not be found.',
  INVALID_PRODUCT_QUANTITY: 'Enter a valid quantity.',
  PRODUCT_NOT_PUBLISHABLE: 'Add at least one photo before activating this listing.',
  PAYOUT_NOT_FOUND: 'That payout could not be found.',
  // Reviews, messages, help (Phase 8)
  REVIEW_ALREADY_EXISTS: "You've already reviewed this order.",
  ORDER_NOT_REVIEWABLE: "This order can be reviewed once it's delivered.",
  SELLER_CANNOT_MESSAGE_SELF: "You can't message your own seller account.",
  // Live chat (16 Oct 2026)
  CHAT_USER_BANNED: "You've been banned from this chat.",
  // Account deletion (28 Oct 2026). ACCOUNT_DELETION_BLOCKED has its own per-reason copy —
  // AccountScreen reads err.details.reasons directly rather than this generic fallback.
  ACCOUNT_DELETION_BLOCKED: 'Account deletion is blocked until a few things are resolved.',
  ACCOUNT_DELETION_ALREADY_PENDING: 'A deletion request is already pending for this account.',
  ACCOUNT_DELETION_NOT_PENDING: 'There is no pending deletion request to cancel.',
};

// Money from the server is minor units. A too-low bid carries the server's minimum in details, as a
// string (BigInt serialised), so both forms are accepted.
function bidTooLowMessage(details: unknown): string {
  const raw = (details as { minimumNext?: unknown } | null)?.minimumNext;
  const minimum = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN;
  if (Number.isFinite(minimum)) {
    return `Your bid must be at least $${(minimum / 100).toFixed(2)}.`;
  }
  return 'Your bid is too low.';
}

// Screens show this text. Branching is done on error.code, never on the server's message.
export function describeApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'BID_TOO_LOW') return bidTooLowMessage(err.details);
    return MESSAGES[err.code] ?? 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}
