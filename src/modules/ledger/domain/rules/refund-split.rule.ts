// Founder-approved dispute/refund policy (engineering backlog Phase 3b, decided WhatsApp
// 19 Oct 2026): the buyer is always refunded in full; the money is taken from what the seller
// still holds with us first, recovered from future sales second, and the platform never
// silently covers the gap. In ledger terms a refund of R against an order whose buyer paid G
// (the order.paid posting's itemAmount) must come out of exactly two places:
//   - the platform's own share of R (proportionally reversed from PLATFORM_REVENUE), and
//   - the seller's share of R (drawn from SELLER_PENDING, then SELLER_AVAILABLE — policy A;
//     if neither actually holds it the seller's balance simply goes negative, which is
//     policy B: a future sale's SELLER_PENDING credit nets it back toward zero, so the
//     "recover from future sales" half needs no separate debt account while no payout flow
//     exists — flagged in 09-DECISIONS, not silently invented).
// The split is proportional so arbitrary partial refunds decompose consistently: reverses
// floor(commission × R / G) from revenue and hands the remainder (R minus that) to the seller
// side, so the two shares ALWAYS sum to exactly R — the refund transaction balances on its
// own no matter how the parts round, with any remainder going to the seller rather than the
// platform (the founder's "platform never covers" framing applied to rounding too).
// For R === G this degenerates to the exact mirror of OnOrderPaidHandler's entry set
// (revenue −commission, seller −(G − commission)), keeping the cancel path and the refund
// path in perfect agreement.
export interface RefundSplitInput {
  readonly refundAmountMinor: bigint;
  // The original order.paid composition the refund is drawn against (the buyer's full
  // payment, which includes the commission — "itemAmount always equals sellerNetAmount +
  // commissionAmount by construction", OnOrderPaidHandler's own comment).
  readonly itemAmountMinor: bigint;
  readonly commissionAmountMinor: bigint;
}

export interface RefundSplit {
  readonly commissionShareMinor: bigint; // DEBIT PLATFORM_REVENUE
  readonly sellerShareMinor: bigint; // DEBIT SELLER_PENDING / SELLER_AVAILABLE
}

// Throws rather than returning a Result: every caller passes amounts that were already
// validated as business inputs (RefundExceedsRemainingError covers R > remaining, and a paid
// order always has positive amounts), so a bad input here is a caller bug, the same
// "throw only for genuinely unexpected conditions" reading build-transaction.rule.ts uses.
export function splitRefundAmount(input: RefundSplitInput): RefundSplit {
  const { refundAmountMinor, itemAmountMinor, commissionAmountMinor } = input;

  if (itemAmountMinor <= 0n) {
    throw new Error(`Refund split needs a positive order total, got ${itemAmountMinor.toString()}`);
  }
  if (refundAmountMinor <= 0n) {
    throw new Error(
      `Refund split needs a positive refund amount, got ${refundAmountMinor.toString()}`,
    );
  }
  if (refundAmountMinor > itemAmountMinor) {
    throw new Error(
      `Refund ${refundAmountMinor.toString()} exceeds the order total ${itemAmountMinor.toString()}`,
    );
  }
  if (commissionAmountMinor < 0n || commissionAmountMinor > itemAmountMinor) {
    throw new Error(
      `Commission ${commissionAmountMinor.toString()} is not a valid part of the order total ${itemAmountMinor.toString()}`,
    );
  }

  // BigInt division truncates toward zero on positives: exact floor.
  const commissionShareMinor = (commissionAmountMinor * refundAmountMinor) / itemAmountMinor;
  // Remainder to the seller so the parts always sum to exactly R.
  const sellerShareMinor = refundAmountMinor - commissionShareMinor;

  return { commissionShareMinor, sellerShareMinor };
}
