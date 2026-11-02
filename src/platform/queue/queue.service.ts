import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue, Job, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { redisConfig } from '../../config/redis.config';
import { injectTraceContext } from '../observability/tracing';
import { QueueName } from './queue.names';

// Every producer in this codebase goes through this one class's enqueue/schedule/
// scheduleRepeating — the single chokepoint where the CURRENT trace context (the one the
// enqueuing HTTP request or WS message is already running inside, per request-id.middleware.ts /
// ws-observability.interceptor.ts) gets attached to the job's data via OTel's own W3C
// `traceparent` propagator. `job-wrapper.ts` extracts it back out on the consumer side. This is
// what makes "trace id propagated into jobs" (02-TRD.md §7) true for every job producer
// automatically, without touching the ~15 call sites across every module that call `enqueue`.
function withTraceContext<T>(data: T): T & { __traceContext: Record<string, string> } {
  return { ...(data as object), __traceContext: injectTraceContext({}) } as T & {
    __traceContext: Record<string, string>;
  };
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });
  private readonly queues = new Map<QueueName, Queue>();

  // Retry defaults for every job in the system, enforced at the one chokepoint every producer
  // already goes through. Fine to retry globally because every job is required to be idempotent
  // (AGENTS.md §4) — sweeps re-scan by status, close/chat/webhook jobs are keyed. Up to 3
  // attempts with 15s exponential backoff (retry ~15s then ~30s later), and a bounded
  // completed/failed ring so the periodic sweeps (some tick multiple times a minute) stop
  // growing Redis without limit. Callers may override per job via opts — the spread order below
  // puts caller opts last, so they win.
  private static readonly JOB_DEFAULTS: JobsOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 15_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  };

  private getQueue(name: QueueName): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.connection });
      this.queues.set(name, queue);
    }
    return queue;
  }

  async enqueue<T = unknown>(
    queueName: QueueName,
    jobName: string,
    data: T,
    opts?: JobsOptions,
  ): Promise<Job> {
    return this.getQueue(queueName).add(jobName, withTraceContext(data), {
      ...QueueService.JOB_DEFAULTS,
      ...opts,
    });
  }

  async schedule<T = unknown>(
    queueName: QueueName,
    jobName: string,
    data: T,
    delayMs: number,
    jobId?: string,
  ): Promise<Job> {
    return this.getQueue(queueName).add(jobName, withTraceContext(data), {
      ...QueueService.JOB_DEFAULTS,
      delay: delayMs,
      ...(jobId !== undefined ? { jobId } : {}),
    });
  }

  // Added in P4-03 for `stream.reconcile` (06-REALTIME-AND-CONCURRENCY.md §11) — the first
  // recurring job in this codebase. Re-adding the same jobId on every boot is idempotent in
  // BullMQ (it replaces the existing repeat schedule rather than duplicating it). Note: a
  // repeating job has no single "enqueuing request" — its trace context is whatever was active
  // the moment the repeat schedule was registered (app boot), not a fresh one per tick. Harmless:
  // the two current callers (stream.reconcile, auction.sweep) are themselves periodic sweeps with
  // no meaningful upstream request to correlate to anyway.
  async scheduleRepeating<T = unknown>(
    queueName: QueueName,
    jobName: string,
    data: T,
    everyMs: number,
    jobId: string,
  ): Promise<void> {
    await this.getQueue(queueName).add(jobName, withTraceContext(data), {
      ...QueueService.JOB_DEFAULTS,
      repeat: { every: everyMs },
      jobId,
    });
  }

  async remove(queueName: QueueName, jobId: string): Promise<void> {
    const job = await this.getQueue(queueName).getJob(jobId);
    if (job) {
      await job.remove();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    await this.connection.quit();
  }
}
