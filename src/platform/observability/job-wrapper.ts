import type { Job } from 'bullmq';
import { context } from '@opentelemetry/api';
import { extractTraceContext, withSpan } from './tracing';
import { jobFailuresCounter } from './metrics';
import { captureException } from './sentry';
import { runWithRequestContext } from '../logger/request-context';
import { QueueName } from '../queue/queue.names';

// Every `modules/*/infra/jobs/*.processor.ts` constructs its own `new Worker(queueName, async
// (job) => {...}, opts)` directly (no shared base class exists — each module owns its processor,
// per MEMORY.md's established P4-03 pattern). This wraps just the processing FUNCTION, not the
// Worker construction itself, so adopting it is a one-line change per processor: wrap the
// existing arrow function, logic inside is untouched. Gives every job: the trace context the
// enqueuer attached (via queue.service.ts's own injectTraceContext on every enqueue/schedule
// call — "trace id propagated into jobs" per 01-ARCHITECTURE.md/02-TRD.md §7), a request-context
// (job id as the correlation id) so log lines during processing carry it, and a job-failure
// counter + Sentry report on any throw — the throw itself is preserved unchanged so BullMQ's own
// retry/backoff behavior is not altered by this wrapper.
export function wrapJobProcessor<T = unknown>(
  queueName: QueueName,
  handler: (job: Job<T>) => Promise<void>,
): (job: Job<T>) => Promise<void> {
  return async (job: Job<T>): Promise<void> => {
    const data = job.data as unknown as { __traceContext?: Record<string, string> };
    const parentContext = extractTraceContext(data?.__traceContext);

    return context.with(parentContext, () =>
      runWithRequestContext({ requestId: job.id ?? 'unknown-job' }, () =>
        withSpan(
          `job.process ${queueName}.${job.name}`,
          async () => {
            try {
              await handler(job);
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err));
              jobFailuresCounter.inc({ queue: queueName, job: job.name });
              captureException(error, { queue: queueName, job: job.name, jobId: job.id });
              throw err;
            }
          },
          { queue: queueName, job: job.name },
          parentContext,
        ),
      ),
    );
  };
}
