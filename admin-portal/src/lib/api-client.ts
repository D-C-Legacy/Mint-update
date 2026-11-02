// HTTP client for the admin portal. Mirrors frontend/src/api/client.ts's exact contract
// (envelope, error shape, refresh-on-401, single-flight refresh) — see 05-API-SPEC.md §1.
// Differences from the mobile client: tokens live in localStorage (web, single profile, no
// per-device secure storage concern), and Idempotency-Key generation is centralized here
// (`idempotent: true`) rather than left to each page, so a refund/payout-trigger call can
// never forget it (admin_progress.md's architecture note).

export const DEFAULT_API_BASE_URL = 'http://localhost:3000/v1';

export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE_URL;

// Copied from the backend registry (src/shared/errors/error-codes.ts). Keep in step with it.
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
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ApiErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(input: { code: string; status: number; message: string; details?: unknown; requestId?: string }) {
    super(input.message);
    this.name = 'ApiError';
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
    this.requestId = input.requestId;
  }
}

export type Tokens = { accessToken: string; refreshToken: string };

const STORAGE_KEY = 'shopaflo-admin.tokens';

export type TokenStore = {
  get(): Tokens | null;
  set(tokens: Tokens): void;
  clear(): void;
};

export function createLocalStorageTokenStore(): TokenStore {
  return {
    get(): Tokens | null {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Tokens) : null;
      } catch {
        return null;
      }
    },
    set(tokens: Tokens): void {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
      } catch {
        // Ignore storage failures (private browsing, quota) — the session just won't persist.
      }
    },
    clear(): void {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore.
      }
    },
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
  // True for mutations the backend's IdempotencyGuard requires (refund, payout-run trigger).
  // The client generates the key, so callers never have to remember to.
  idempotent?: boolean;
  // Public/auth routes pass false: no bearer header and no refresh attempt.
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

  async function send(path: string, opts: RequestOptions, accessToken: string | undefined): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (opts.idempotent) headers['Idempotency-Key'] = crypto.randomUUID();
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

  // One refresh serves every caller. Two requests that both hit 401 share one rotation, so
  // the second never presents a refresh token the first one already consumed.
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
      res = await send('/auth/refresh', { method: 'POST', body: { refreshToken: current.refreshToken }, auth: false }, undefined);
    } catch {
      return false;
    }
    if (!res.ok) {
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
    async login(email: string, password: string): Promise<AuthResult> {
      const data = await request<AuthResult>('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      options.tokens.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return data;
    },
    logout(): void {
      options.tokens.clear();
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
