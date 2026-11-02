import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { generateId } from '../../shared/ids/id';
import { runWithRequestContext } from './request-context';

// Registered directly on the underlying Fastify instance (`onRequest` hook) rather than as a
// `NestMiddleware`/`app.use()` — Fastify's own hook API gives direct `request`/`reply` access and
// avoids depending on Express-middleware-compat shims under the hood. 05-API-SPEC.md §1:
// `X-Request-Id` is "optional, echoed back, generated if absent" — this is that mechanism, plus
// the AsyncLocalStorage context every later guard/service/log line in the same request reads from.
// Must run before anything else that reads `getRequestContext()` — registered first, in
// `main.api.ts`/`main.realtime.ts`, immediately after `NestFactory.create()`.
export function registerRequestContext(app: NestFastifyApplication): void {
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', (request, reply, done) => {
    const header = request.headers['x-request-id'];
    const requestId = (Array.isArray(header) ? header[0] : header) || generateId();
    reply.header('X-Request-Id', requestId);
    runWithRequestContext({ requestId }, done);
  });
}
