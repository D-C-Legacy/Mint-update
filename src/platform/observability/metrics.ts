import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { redisConfig } from '../../config/redis.config';
import { QueueNames, QueueName } from '../queue/queue.names';

// 02-TRD.md §7's metrics list, one object per bullet: "bid latency histogram, WS connections, room
// count, queue depth, job failure rate." Wraps prom-client (AGENTS.md §4: "wraps a library so
// modules never import the library directly") — a module updates these exported metric objects
// directly wherever the relevant event happens (PlaceBidUseCase observes bidLatencyHistogram,
// StreamingGateway sets wsConnectionsGauge, PresenceService's existing 30s reaper tick sets
// roomCountGauge, job-wrapper.ts increments jobFailuresCounter) rather than this file reaching
// into business modules — same dependency direction as CLOCK/EVENT_BUS/RateLimitService: modules
// depend on platform, never the reverse.
export const register = new Registry();
collectDefaultMetrics({ register });

// Real bug found and fixed in P9-04, pre-dating this ticket: `PlaceBidUseCase` observes this via
// `.startTimer()`, and prom-client's `startTimer()` always reports elapsed time in SECONDS (its
// own doc: "observe the duration in seconds") — this histogram's name/buckets were originally
// written as if `.startTimer()` reported milliseconds, so every real observation (a few
// milliseconds = a few thousandths of a second) landed in the smallest bucket regardless of
// actual latency, making the metric's resolution useless. Found while building P9-04's bid
// latency p95 alert check, which needed to actually interpret these bucket values. Fixed by
// renaming to the `_seconds` suffix (Prometheus's own naming convention for duration metrics,
// which this should have followed from the start) and converting the bucket boundaries to
// seconds — the call site in `place-bid.usecase.ts` needed no change at all, since `.startTimer()`
// was always correct; only this histogram's own declared unit was wrong.
export const bidLatencyHistogram = new Histogram({
  name: 'bid_validate_and_persist_duration_seconds',
  help: 'Time to validate and persist a bid, seconds (02-TRD.md §8 budget: p95 < 40ms = 0.04s)',
  buckets: [0.005, 0.01, 0.02, 0.04, 0.08, 0.16, 0.32, 1],
  registers: [register],
});

export const wsConnectionsGauge = new Gauge({
  name: 'ws_connections',
  help: 'Currently connected Socket.IO clients on this process',
  registers: [register],
});

export const roomCountGauge = new Gauge({
  name: 'room_count',
  help: 'Currently live stream sessions (rooms)',
  registers: [register],
});

export const jobFailuresCounter = new Counter({
  name: 'job_failures_total',
  help: 'Job processing failures, by queue and job name',
  labelNames: ['queue', 'job'] as const,
  registers: [register],
});

// Queue depth is pulled at scrape time (renderMetrics), not pushed — the Prometheus pull model's
// natural fit, and it avoids a redundant background poller duplicating what a scrape already
// triggers. Lightweight, read-only Queue handles constructed directly here (own Redis connection,
// same pattern QueueService itself uses) — deliberately NOT going through QueueService/
// QueueModule DI, so this file has no dependency on anything beyond platform/redis's own config.
const queueDepthGauge = new Gauge({
  name: 'queue_depth',
  help: 'Waiting + active + delayed jobs, by queue',
  labelNames: ['queue'] as const,
  registers: [register],
});

const statsConnection = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });
const statsQueues = new Map<QueueName, Queue>(
  Object.values(QueueNames).map((name) => [name, new Queue(name, { connection: statsConnection })]),
);

async function refreshQueueDepths(): Promise<void> {
  await Promise.all(
    [...statsQueues.entries()].map(async ([name, queue]) => {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
      const depth = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
      queueDepthGauge.set({ queue: name }, depth);
    }),
  );
}

export async function renderMetrics(): Promise<{ contentType: string; body: string }> {
  await refreshQueueDepths();
  return { contentType: register.contentType, body: await register.metrics() };
}

// Exposed for P9-04's alert sweep so it can query recent failed jobs per queue without opening a
// second redundant set of Redis/BullMQ connections — same read-only `Queue` handles this file
// already maintains for the depth gauge.
export function getQueueHandle(name: QueueName): Queue {
  const queue = statsQueues.get(name);
  if (!queue) {
    // Every QueueName value is seeded into this map at module load, immediately above — a miss
    // here means QueueNames changed shape without this map being rebuilt, a real bug worth a
    // loud throw, not a silent undefined.
    throw new Error(`No Queue handle for "${name}" — statsQueues was not seeded for this queue name.`);
  }
  return queue;
}

export function estimateHistogramQuantile(
  histogramValues: { value: number; labels: Record<string, unknown> }[],
  quantile: number,
): number | null {
  // Bucket rows (and only bucket rows) carry an `le` label; `_sum`/`_count` rows don't, so this
  // filter alone isolates them without needing to match on `metricName`. The `+Inf` bucket's `le`
  // is the literal string `"+Inf"`, which `Number("+Inf")` parses to `NaN` — excluded from the
  // finite list below, but its cumulative count IS the true total, so `total` is taken as the max
  // cumulative across every bucket (not "whichever sorts last"), robust to where a `NaN` `le`
  // lands in a sort.
  const buckets = histogramValues
    .filter((v) => 'le' in v.labels && v.labels['le'] !== undefined)
    .map((v) => ({ le: Number(v.labels['le']), cumulative: v.value }));
  const total = buckets.reduce((max, b) => Math.max(max, b.cumulative), 0);
  if (total === 0) {
    return null;
  }
  const target = total * quantile;
  const finite = buckets.filter((b) => Number.isFinite(b.le)).sort((a, b) => a.le - b.le);
  for (const b of finite) {
    if (b.cumulative >= target) {
      return b.le;
    }
  }
  // Only the +Inf bucket reached the target — the true value exceeds every finite boundary;
  // report the highest finite boundary as a (deliberately conservative) lower-bound estimate.
  const highest = finite.at(-1);
  return highest ? highest.le : null;
}

export async function closeMetricsConnections(): Promise<void> {
  await Promise.all([...statsQueues.values()].map((q) => q.close()));
  await statsConnection.quit();
}
