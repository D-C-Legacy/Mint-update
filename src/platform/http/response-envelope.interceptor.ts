import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { getRequestContext } from '../logger/request-context';

// Closes the long-flagged `meta.requestId` gap (05-API-SPEC.md §1's envelope: `{"data": {...},
// "meta": {"requestId": "01J..."}}`, never built early — see P1-04/P5-09's MEMORY notes). Applied
// globally (`app.useGlobalInterceptors`) so no controller needs to change: every controller
// already returns a plain `{data: ...}` (or `{data: [...]}`} object, this just merges `meta` in
// after the fact. `GlobalExceptionFilter` does the equivalent merge for the error path, since an
// error response never reaches an interceptor's success pipe.
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((body: unknown) => {
        const requestId = getRequestContext()?.requestId;
        if (!requestId || typeof body !== 'object' || body === null || Array.isArray(body)) {
          return body;
        }
        const existingMeta = (body as { meta?: Record<string, unknown> }).meta;
        return { ...body, meta: { ...existingMeta, requestId } };
      }),
    );
  }
}
