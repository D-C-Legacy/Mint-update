// Typed wrappers around the admin payouts/ledger routes. Shapes hand-mirror the backend
// entities (payout.entity.ts, payout-run.entity.ts, payout-item.entity.ts,
// ledger.service.ts's ReconciliationReport/BalanceMismatch).
import { apiClient } from '../auth/AuthContext';
import type { CursorPage } from './applications';

export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'REVERSED' | 'HELD';
export type PayoutRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type PayoutItem = {
  id: string;
  payoutId: string;
  orderId: string;
  amount: number;
};

export type Payout = {
  id: string;
  runId: string;
  sellerId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  idempotencyKey: string;
  providerTransferId: string | null;
  failureReason: string | null;
  sentAt: string | null;
  createdAt: string;
  items: PayoutItem[];
};

export type PayoutRun = {
  id: string;
  status: PayoutRunStatus;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  payoutCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type RunPayoutResult = { run: PayoutRun; payoutsCreated: number };

export type BalanceMismatch = {
  sellerId: string;
  field: string;
  cached: number;
  recomputed: number;
};

export type ReconciliationReport = {
  ok: boolean;
  unbalancedTransactionIds: string[];
  sellersChecked: number;
  balanceMismatches: BalanceMismatch[];
  // Mirror of the backend ledger service's CashCheck (3c): the ledger's USD PLATFORM_CASH vs the
  // processor's real wallet (Stripe balance, available + pending). Minor units, plain numbers.
  cashCheck: {
    status: 'OK' | 'MISMATCH';
    ledgerCashBalance: number;
    processorAvailableMinor: number;
    processorPendingMinor: number;
    processorCashBalance: number;
  };
};

export function listPayoutRuns(params: { cursor?: string }): Promise<CursorPage<PayoutRun>> {
  return apiClient.request('/admin/payout-runs', { query: { cursor: params.cursor, limit: 20 } });
}

export function triggerPayoutRun(): Promise<RunPayoutResult> {
  return apiClient.request('/admin/payout-runs', { method: 'POST', idempotent: true });
}

export function listPayouts(params: {
  status: PayoutStatus;
  cursor?: string;
}): Promise<CursorPage<Payout>> {
  return apiClient.request('/admin/payouts', {
    query: { status: params.status, cursor: params.cursor, limit: 20 },
  });
}

export function holdPayout(payoutId: string): Promise<Payout> {
  return apiClient.request(`/admin/payouts/${payoutId}/hold`, { method: 'POST' });
}

export function getReconciliationReport(): Promise<ReconciliationReport> {
  return apiClient.request('/admin/ledger/reconciliation');
}
