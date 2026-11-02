import { describe, expect, it } from 'vitest';
import { splitRefundAmount, RefundSplitInput } from './refund-split.rule';

function input(overrides: Partial<RefundSplitInput> = {}): RefundSplitInput {
  // Matches the shape of a real order.paid posting: buyer pays 1500 gross, of which the
  // seller's net is 1215 and the platform's commission is 285.
  return {
    refundAmountMinor: 1500n,
    itemAmountMinor: 1500n,
    commissionAmountMinor: 285n,
    ...overrides,
  };
}

describe('splitRefundAmount', () => {
  // 03-DATA-MODEL.md §10's consistency requirement, restated for refunds: a full refund must
  // reverse exactly what order.paid posted — revenue −285, seller −1215, nothing invented.
  it('splits a full refund as the exact mirror of the order.paid entries', () => {
    const split = splitRefundAmount(input());

    expect(split.commissionShareMinor).toBe(285n);
    expect(split.sellerShareMinor).toBe(1215n);
  });

  it('splits a half refund proportionally', () => {
    const split = splitRefundAmount(input({ refundAmountMinor: 750n }));

    // 285 × 750 / 1500 = 142.5 → floor 142; the .5 remainder goes to the seller side.
    expect(split.commissionShareMinor).toBe(142n);
    expect(split.sellerShareMinor).toBe(608n);
  });

  it('sends the rounding remainder to the seller, never the platform', () => {
    // 285 × 1 / 1500 = 0.19 → floor 0; a 1-cent refund reverses no revenue, all seller.
    const split = splitRefundAmount(input({ refundAmountMinor: 1n }));

    expect(split.commissionShareMinor).toBe(0n);
    expect(split.sellerShareMinor).toBe(1n);
  });

  it('keeps the two shares summing to exactly the refund amount for a 0-commission order', () => {
    const split = splitRefundAmount(
      input({ itemAmountMinor: 1500n, commissionAmountMinor: 0n, refundAmountMinor: 999n }),
    );

    expect(split.commissionShareMinor).toBe(0n);
    expect(split.sellerShareMinor).toBe(999n);
  });

  it('handles a 100%-commission seller: the whole refund reverses revenue, the seller side is 0', () => {
    const split = splitRefundAmount(
      input({ itemAmountMinor: 1500n, commissionAmountMinor: 1500n }),
    );

    expect(split.commissionShareMinor).toBe(1500n);
    expect(split.sellerShareMinor).toBe(0n);
  });

  it('handles a single-cent-style remainder cleanly', () => {
    // 100 × 100 / 300 = 33.33 → 33; seller gets 100 − 33 = 67.
    const split = splitRefundAmount(
      input({ itemAmountMinor: 300n, commissionAmountMinor: 100n, refundAmountMinor: 100n }),
    );

    expect(split.commissionShareMinor).toBe(33n);
    expect(split.sellerShareMinor).toBe(67n);
  });

  it('rejects a refund larger than the order total (caller should have caught that)', () => {
    expect(() => splitRefundAmount(input({ refundAmountMinor: 1501n }))).toThrow();
  });

  it('rejects zero and negative refunds', () => {
    expect(() => splitRefundAmount(input({ refundAmountMinor: 0n }))).toThrow();
    expect(() => splitRefundAmount(input({ refundAmountMinor: -5n }))).toThrow();
  });

  it('rejects a zero order total', () => {
    expect(() => splitRefundAmount(input({ itemAmountMinor: 0n }))).toThrow();
  });

  it('rejects a commission larger than the order total', () => {
    expect(() => splitRefundAmount(input({ commissionAmountMinor: 1501n }))).toThrow();
  });
});
