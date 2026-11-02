import { AsyncLocalStorage } from 'node:async_hooks';

// Holds the "business" correlation fields 01-ARCHITECTURE.md's logging row names (request id,
// user id, room id) — deliberately separate from OpenTelemetry's own trace/span id, which
// LoggerService reads independently via `@opentelemetry/api`'s active span. Request id is a
// client-visible concept (05-API-SPEC.md §1's `X-Request-Id`/`meta.requestId`); trace id is an
// internal infra concern never exposed in the API contract — two different ids, kept separate on
// purpose rather than collapsed into one.
export interface RequestContext {
  requestId: string;
  userId?: string;
  roomId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

// The stored object is held by reference for the lifetime of the async chain it was created for
// — callers that learn the user id or room id partway through (JwtGuard/WsAuthGuard resolving
// `request.user` after the context was already established by request-id middleware, a gateway
// handler learning which room a message targets) mutate the same object in place via
// `setRequestContextField`, rather than needing to re-enter `.run()` with a new one.
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function setRequestContextField<K extends keyof RequestContext>(key: K, value: RequestContext[K]): void {
  const ctx = storage.getStore();
  if (ctx) {
    ctx[key] = value;
  }
}
