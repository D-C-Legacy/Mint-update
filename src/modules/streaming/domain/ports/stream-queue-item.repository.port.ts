import { QueueItemMode, StreamQueueItem } from '../entities/stream-queue-item.entity';

export const STREAM_QUEUE_ITEM_REPOSITORY = Symbol('StreamQueueItemRepositoryPort');

export interface CreateQueueItemInput {
  readonly id: string;
  readonly sessionId: string;
  readonly productId: string;
  readonly position: number;
  readonly mode: QueueItemMode;
  readonly startAmount: bigint | null;
  readonly price: bigint | null;
  readonly quantity: number | null;
}

export interface ReorderInput {
  readonly id: string;
  readonly position: number;
}

export interface StreamQueueItemRepositoryPort {
  findById(id: string): Promise<StreamQueueItem | null>;
  /** Ordered by position, ascending — the lineup as the seller/system sees it. */
  listBySession(sessionId: string): Promise<StreamQueueItem[]>;
  /** The single ACTIVE item for this session, if any (at most one, enforced at the application
   *  layer — see FeatureQueueItemUseCase). Null when nothing's currently featured. */
  findActiveBySession(sessionId: string): Promise<StreamQueueItem | null>;
  /** Mid-stream inserts are allowed (founder_requests.md §2, decided 14 Oct 2026) — `position` is
   *  caller-supplied, not auto-appended, so the use case can insert anywhere in the lineup. */
  create(input: CreateQueueItemInput): Promise<StreamQueueItem>;
  /** Bulk position rewrite for a live reorder — one statement per item, not wrapped in the
   *  caller's own transaction (reordering has no money/state-machine stakes, unlike bid
   *  concurrency, so a single transaction per item is simpler and fine). */
  reorder(items: readonly ReorderInput[]): Promise<void>;
  /** Marks this item ACTIVE and links it to the sale that was just opened/reused for it. */
  markActive(id: string, saleId: string): Promise<StreamQueueItem>;
  /** Marks this item DONE — used when a different item is featured, superseding it. Does NOT
   *  touch the underlying Sale (featuring a new item doesn't auto-cancel the old one's sale; see
   *  FeatureQueueItemUseCase's own comment for why that's a deliberately conservative default). */
  markDone(id: string): Promise<StreamQueueItem>;
}
