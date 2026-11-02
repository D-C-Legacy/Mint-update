import type { SaleDetail } from "../api/sales";

// How the sale events in 06-REALTIME-AND-CONCURRENCY.md §2 change a sale the screen already holds.
// Each function is pure: it takes the current sale and the event payload and returns the new sale,
// or the same object when the event does not apply (another sale, malformed, or out of date).
// Payloads arrive from the network, so every field is checked before use.

type Obj = Record<string, unknown>;

function obj(payload: unknown): Obj | null {
  return typeof payload === "object" && payload !== null ? (payload as Obj) : null;
}

function int(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// sale.updated { saleId, currentAmount, endsAt, bidCount }. Auction amounts only go up, so an
// event older than what is already shown (a late delivery, or a snapshot fetched after it) is
// ignored instead of moving the price backwards. A sale that already ended never reopens.
export function applySaleUpdated(sale: SaleDetail, payload: unknown): SaleDetail {
  const p = obj(payload);
  if (!p || p["saleId"] !== sale.id || sale.status !== "OPEN") return sale;
  const currentAmount = int(p["currentAmount"]);
  if (currentAmount === null || currentAmount < (sale.currentAmount ?? 0)) return sale;
  const endsAt = typeof p["endsAt"] === "string" ? p["endsAt"] : sale.endsAt;
  return { ...sale, currentAmount, endsAt };
}

// sale.extended { saleId, endsAt, extensionCount } (the anti-snipe rule moved the end time).
export function applySaleExtended(sale: SaleDetail, payload: unknown): SaleDetail {
  const p = obj(payload);
  if (!p || p["saleId"] !== sale.id || sale.status !== "OPEN" || typeof p["endsAt"] !== "string") return sale;
  return { ...sale, endsAt: p["endsAt"] };
}

// sale.resolved { saleId, winnerUserId, finalAmount }.
export function applySaleResolved(sale: SaleDetail, payload: unknown): SaleDetail {
  const p = obj(payload);
  if (!p || p["saleId"] !== sale.id) return sale;
  const finalAmount = int(p["finalAmount"]);
  return {
    ...sale,
    status: "RESOLVED",
    winnerUserId: typeof p["winnerUserId"] === "string" ? p["winnerUserId"] : null,
    finalAmount,
    currentAmount: finalAmount ?? sale.currentAmount,
  };
}

// sale.cancelled { saleId, reason }. A sale that already resolved stays resolved.
export function applySaleCancelled(sale: SaleDetail, payload: unknown): SaleDetail {
  const p = obj(payload);
  if (!p || p["saleId"] !== sale.id || sale.status === "RESOLVED") return sale;
  return { ...sale, status: "CANCELLED" };
}

// bid.outbid { saleId, newAmount }: the text shown to the previous leader, or null when the event
// is about another sale.
export function outbidMessage(saleId: string, payload: unknown): string | null {
  const p = obj(payload);
  if (!p || p["saleId"] !== saleId) return null;
  const amount = int(p["newAmount"]);
  return amount === null
    ? "You were outbid."
    : `You were outbid. The current bid is $${(amount / 100).toFixed(2)}.`;
}

// offer.responded { offerId, status, counterAmount }: the text for the offering buyer, or null when
// the offer is not the one this screen is tracking.
export function offerResponseMessage(offerId: string | null, payload: unknown): string | null {
  const p = obj(payload);
  if (!offerId || !p || p["offerId"] !== offerId) return null;
  switch (p["status"]) {
    case "ACCEPTED":
      return "The seller accepted your offer.";
    case "REJECTED":
      return "The seller declined your offer.";
    case "COUNTERED": {
      const counter = int(p["counterAmount"]);
      return counter === null
        ? "The seller sent a counter offer."
        : `The seller countered with $${(counter / 100).toFixed(2)}.`;
    }
    default:
      return null;
  }
}
