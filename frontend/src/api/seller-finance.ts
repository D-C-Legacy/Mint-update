import { api } from "./index";
import type { Page } from "./catalog";

// GET /v1/seller/balance, /seller/ledger, /seller/payouts, /seller/payouts/:id
// (05-API-SPEC.md §10) — not in the app before Phase 7; no HTTP route existed for any of these
// until now (see integration_progress.md's Phase 7 write-up). Money is integer minor units.
export type SellerBalance = {
  currency: string;
  pendingAmount: number;
  availableAmount: number;
  paidOutAmount: number;
};

export type LedgerEntry = {
  id: string;
  transactionType: string;
  referenceType: string;
  referenceId: string;
  accountType: "SELLER_PENDING" | "SELLER_AVAILABLE" | "SELLER_PAID_OUT" | string;
  direction: "DEBIT" | "CREDIT";
  amount: number;
  currency: string;
  createdAt: string;
};

export type PayoutStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "REVERSED" | "HELD";

export type Payout = {
  id: string;
  runId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  failureReason: string | null;
  sentAt: string | null;
  createdAt: string;
  items: Array<{ orderId: string; amount: number }>;
};

export type PayoutStatement = {
  payoutId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  sentAt: string | null;
  items: Array<{ orderId: string; amount: number }>;
};

export function getBalance(): Promise<SellerBalance> {
  return api.request<SellerBalance>("/seller/balance");
}

export function listLedgerEntries(filter: { cursor?: string; limit?: number } = {}): Promise<Page<LedgerEntry>> {
  return api.request<Page<LedgerEntry>>("/seller/ledger", { query: { ...filter } });
}

export function listPayouts(filter: { status?: PayoutStatus; cursor?: string; limit?: number } = {}): Promise<Page<Payout>> {
  return api.request<Page<Payout>>("/seller/payouts", { query: { ...filter } });
}

export function getPayoutStatement(id: string): Promise<PayoutStatement> {
  return api.request<PayoutStatement>(`/seller/payouts/${encodeURIComponent(id)}`);
}
