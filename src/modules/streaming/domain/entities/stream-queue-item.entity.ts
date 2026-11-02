export type QueueItemStatus = 'PENDING' | 'ACTIVE' | 'DONE';

// Mirrors sales' SaleMode exactly — declared locally rather than imported across the module
// boundary. `sales` doesn't import `streaming`'s domain types either; cross-module reach only
// goes through application/*.service.ts (AGENTS.md §4), same precedent sales.errors.ts's own
// comment documents for catalog's OutOfStockError. OFFER became a queue-plannable mode 16 Oct
// 2026 (founder_requests.md §1/offers-and-activity-progress.md decision: OFFER is its own
// selectable live sale mode, same as Auction/Buy Now).
export type QueueItemMode = 'AUCTION' | 'BUY_NOW' | 'OFFER';

export interface StreamQueueItem {
  readonly id: string;
  readonly sessionId: string;
  readonly productId: string;
  readonly position: number;
  readonly mode: QueueItemMode;
  // Mode-conditional pricing, captured up front at add-to-queue time (round5 §5, 26 Oct 2026) so
  // the auto-advance job has something to feature with — AUCTION uses startAmount, BUY_NOW uses
  // price+quantity, OFFER uses neither. Nullable: rows created before this existed have none set.
  readonly startAmount: bigint | null;
  readonly price: bigint | null;
  readonly quantity: number | null;
  readonly status: QueueItemStatus;
  readonly saleId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
