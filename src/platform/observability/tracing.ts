import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { trace, context, propagation, SpanStatusCode, Span, Tracer, Context } from '@opentelemetry/api';

// 01-ARCHITECTURE.md/02-TRD.md §7: "OpenTelemetry, trace id propagated into WS and jobs." No
// OTel collector exists anywhere in this stack's docs/.env — `ConsoleSpanExporter` is the honest
// choice (same treatment as every other "no real external backend configured" case in this build:
// Stripe/Resend/LiveKit all got real adapters pointed at dummy/sandbox endpoints, never a mock).
// Swapping to a real exporter (OTLP to a collector) later is a one-line change here, nowhere else.
//
// Must be the FIRST import in every `main.*.ts` (before `@nestjs/core`, before anything that
// transitively `require()`s Node's `http` module) — `HttpInstrumentation` patches `http`/`https`
// at require-time, and a module that captured a reference to the unpatched functions before this
// runs will never be instrumented. This is why it's a side-effecting import (like
// `shared/money/bigint-json.ts`), not a function a caller invokes after their own imports.
const serviceName = process.env.SERVICE_NAME ?? 'app';

const sdk = new NodeSDK({
  serviceName,
  traceExporter: new ConsoleSpanExporter(),
  instrumentations: [new HttpInstrumentation()],
});

sdk.start();

process.on('SIGTERM', () => void sdk.shutdown());
process.on('SIGINT', () => void sdk.shutdown());

export const tracer: Tracer = trace.getTracer(serviceName);

// The one utility WS gateways and job processors use for manual spans — HTTP gets instrumented
// automatically, but nothing auto-instruments a BullMQ job pickup or a Socket.IO message handler,
// which is exactly the "propagated into WS and jobs" half of this requirement that needs
// deliberate code, not just the SDK being present.
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
  parentContext?: Context,
): Promise<T> {
  return tracer.startActiveSpan(name, {}, parentContext ?? context.active(), async (span) => {
    if (attributes) {
      span.setAttributes(attributes);
    }
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

// Carries the active trace context across a process boundary a BullMQ job crosses — the W3C
// `traceparent` format via OTel's own propagator, the same mechanism a real HTTP call to another
// service would use, just serialized into the job's data instead of a request header.
export function injectTraceContext(carrier: Record<string, string>): Record<string, string> {
  propagation.inject(context.active(), carrier);
  return carrier;
}

export function extractTraceContext(carrier: Record<string, string> | undefined): Context {
  return propagation.extract(context.active(), carrier ?? {});
}
