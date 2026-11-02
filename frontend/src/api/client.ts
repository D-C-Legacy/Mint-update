// HTTP client for the Live Auction backend.
// Contract: 05-API-SPEC.md §1 (envelope, error shape, headers). Every path is relative to
// API_BASE_URL, and that base already includes the /v1 prefix, so callers pass "/auth/login".

export const DEFAULT_API_BASE_URL = 'http://localhost:3000/v1';

// Expo inlines EXPO_PUBLIC_* at build time, so this resolves per build, not at runtime.
export const API_BASE_URL: string = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL;

// Copied from the backend registry (src/shared/errors/error-codes.ts). Keep in step with it.
// NETWORK_ERROR and UNKNOWN_ERROR are client-side only and never come from the server.
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_KEY_CONFLICT: 'IDEMPOTENCY_KEY_CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  CURRENT_PASSWORD_INCORRECT: 'CURRENT_PASSWORD_INCORRECT',
  ADDRESS_LIMIT_REACHED: 'ADDRESS_LIMIT_REACHED',
  SELLER_APPLICATION_NOT_FOUND: 'SELLER_APPLICATION_NOT_FOUND',
  INVALID_SELLER_STATUS: 'INVALID_SELLER_STATUS',
  SELLER_DOCUMENT_NOT_FOUND: 'SELLER_DOCUMENT_NOT_FOUND',
  SELLER_NOT_APPROVED: 'SELLER_NOT_APPROVED',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  INVALID_PRODUCT_QUANTITY: 'INVALID_PRODUCT_QUANTITY',
  PRODUCT_IMAGE_NOT_FOUND: 'PRODUCT_IMAGE_NOT_FOUND',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  INVALID_STOCK_RELEASE: 'INVALID_STOCK_RELEASE',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  STREAM_SESSION_NOT_FOUND: 'STREAM_SESSION_NOT_FOUND',
  INVALID_STREAM_STATUS: 'INVALID_STREAM_STATUS',
  STREAM_NOT_LIVE: 'STREAM_NOT_LIVE',
  CHAT_USER_BANNED: 'CHAT_USER_BANNED',
  CHAT_MESSAGE_NOT_FOUND: 'CHAT_MESSAGE_NOT_FOUND',
  SALE_NOT_FOUND: 'SALE_NOT_FOUND',
  SALE_NOT_OPEN: 'SALE_NOT_OPEN',
  SALE_ENDED: 'SALE_ENDED',
  BID_TOO_LOW: 'BID_TOO_LOW',
  BID_BY_SELLER: 'BID_BY_SELLER',
  BIDDER_ALREADY_LEADING: 'BIDDER_ALREADY_LEADING',
  OFFER_NOT_FOUND: 'OFFER_NOT_FOUND',
  OFFER_EXPIRED: 'OFFER_EXPIRED',
  INVALID_ORDER_STATUS: 'INVALID_ORDER_STATUS',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  PAYMENT_NOT_SUCCEEDED: 'PAYMENT_NOT_SUCCEEDED',
  REFUND_EXCEEDS_REMAINING: 'REFUND_EXCEEDS_REMAINING',
  PAYOUT_NOT_FOUND: 'PAYOUT_NOT_FOUND',
  INVALID_PAYOUT_STATUS: 'INVALID_PAYOUT_STATUS',
  REVIEW_ALREADY_EXISTS: 'REVIEW_ALREADY_EXISTS',
  ORDER_NOT_REVIEWABLE: 'ORDER_NOT_REVIEWABLE',
  SELLER_CANNOT_MESSAGE_SELF: 'SELLER_CANNOT_MESSAGE_SELF',
  ACCOUNT_DELETION_BLOCKED: 'ACCOUNT_DELETION_BLOCKED',
  ACCOUNT_DELETION_ALREADY_PENDING: 'ACCOUNT_DELETION_ALREADY_PENDING',
  ACCOUNT_DELETION_NOT_PENDING: 'ACCOUNT_DELETION_NOT_PENDING',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ApiErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// One error type for every failure. Screens branch on `code`, never on `message`.
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(input: {
    code: string;
    status: number;
    message: string;
    details?: unknown;
    requestId?: string;
  }) {
    super(input.message);
    this.name = 'ApiError';
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
    this.requestId = input.requestId;
  }
}

export type Tokens = { accessToken: string; refreshToken: string };

// Storage is injected so the client never decides where tokens live. get/set/clear stay
// synchronous because every request on the hot path (attaching the access token, refreshing on
// a 401) needs them to be — any store backed by async storage keeps its own in-memory copy as the
// real source of truth for those and only uses hydrate() to fill it in once, at startup.
export type TokenStore = {
  get(): Tokens | null;
  set(tokens: Tokens): void;
  clear(): void;
  // Loads whatever was persisted from a previous run, if anything, before the first get() that
  // matters (AuthProvider's restore-on-launch check). A no-op for a store with nothing to load.
  hydrate(): Promise<void>;
};

export function createMemoryTokenStore(): TokenStore {
  let current: Tokens | null = null;
  return {
    get: () => current,
    set: (tokens) => {
      current = tokens;
    },
    clear: () => {
      current = null;
    },
    hydrate: () => Promise.resolve(),
  };
}

export type ApiClientOptions = {
  tokens: TokenStore;
  baseUrl?: string;
  fetch?: typeof fetch;
};

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  idempotencyKey?: string;
  // Public routes and auth routes pass false: no bearer header and no refresh attempt.
  auth?: boolean;
};

export type AuthResult = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  user: { id: string; displayName: string; role: string };
};

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = (options.baseUrl ?? API_BASE_URL).replace(/\/$/, '');
  const doFetch = options.fetch ?? fetch;
  let refreshing: Promise<boolean> | null = null;

  function buildUrl(path: string, query: RequestOptions['query']): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString();
    return `${baseUrl}${path}${qs ? `?${qs}` : ''}`;
  }

  async function send(
    path: string,
    opts: RequestOptions,
    accessToken: string | undefined,
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
    try {
      return await doFetch(buildUrl(path, opts.query), {
        method: opts.method ?? 'GET',
        headers,
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      });
    } catch (cause) {
      throw new ApiError({
        code: ErrorCodes.NETWORK_ERROR,
        status: 0,
        message: cause instanceof Error ? cause.message : 'Network request failed',
      });
    }
  }

  // Maps the §1 envelope to either `data` or an ApiError. Unknown shapes become UNKNOWN_ERROR.
  async function unwrap<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    const envelope = body as {
      data?: T;
      error?: { code?: string; message?: string; details?: unknown };
      meta?: { requestId?: string };
    } | null;

    if (res.ok) {
      if (envelope && typeof envelope === 'object' && 'data' in envelope) {
        return envelope.data as T;
      }
      throw new ApiError({
        code: ErrorCodes.UNKNOWN_ERROR,
        status: res.status,
        message: 'Response was not in the expected envelope',
      });
    }

    const requestId = envelope?.meta?.requestId;
    if (envelope?.error?.code) {
      throw new ApiError({
        code: envelope.error.code,
        status: res.status,
        message: envelope.error.message ?? envelope.error.code,
        details: envelope.error.details,
        ...(requestId !== undefined ? { requestId } : {}),
      });
    }
    throw new ApiError({
      code: ErrorCodes.UNKNOWN_ERROR,
      status: res.status,
      message: `Request failed with status ${res.status}`,
      ...(requestId !== undefined ? { requestId } : {}),
    });
  }

  // One refresh serves every caller. Two requests that both hit 401 share one rotation,
  // so the second never presents a refresh token the first one already consumed.
  function refreshOnce(): Promise<boolean> {
    if (!refreshing) {
      refreshing = refreshTokens().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  async function refreshTokens(): Promise<boolean> {
    const current = options.tokens.get();
    if (!current) return false;
    let res: Response;
    try {
      res = await send(
        '/auth/refresh',
        { method: 'POST', body: { refreshToken: current.refreshToken }, auth: false },
        undefined,
      );
    } catch {
      return false;
    }
    if (!res.ok) {
      // Refresh tokens rotate and are single-use. On web, every tab shares the same
      // localStorage with no coordination, so two tabs can both read the same refresh
      // token and race /auth/refresh at once: the loser lands here even though the
      // session is actually fine, because the winner already rotated it. Give the
      // winner's write a moment to land before giving up on a session that isn't dead.
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        const afterFailure = options.tokens.get();
        if (afterFailure && afterFailure.refreshToken !== current.refreshToken) {
          return true;
        }
      }
      options.tokens.clear();
      return false;
    }
    const data = await unwrap<AuthResult>(res);
    options.tokens.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return true;
  }

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const useAuth = opts.auth !== false;
    const first = await send(path, opts, useAuth ? options.tokens.get()?.accessToken : undefined);
    if (first.status === 401 && useAuth && options.tokens.get()) {
      const refreshed = await refreshOnce();
      if (refreshed) {
        const retry = await send(path, opts, options.tokens.get()?.accessToken);
        return unwrap<T>(retry);
      }
    }
    return unwrap<T>(first);
  }

  return {
    request,
    // Sign-in stores the returned tokens. A failed login throws and stores nothing.
    async login(email: string, password: string): Promise<AuthResult> {
      const data = await request<AuthResult>('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      options.tokens.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return data;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
