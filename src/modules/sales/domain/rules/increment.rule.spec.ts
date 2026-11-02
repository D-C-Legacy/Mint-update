import { describe, expect, it } from 'vitest';
import { minimumNextBid, IncrementBand } from './increment.rule';

const FLAT_DOLLAR_BAND: readonly IncrementBand[] = [{ minAmount: 0n, incrementAmount: 100n }];

const MULTI_BAND: readonly IncrementBand[] = [
  { minAmount: 0n, incrementAmount: 100n },
  { minAmount: 5_000n, incrementAmount: 500n },
  { minAmount: 20_000n, incrementAmount: 1_000n },
];

describe('minimumNextBid', () => {
  it('adds the flat increment at the lowest price', () => {
    expect(minimumNextBid(0n, FLAT_DOLLAR_BAND)).toBe(100n);
  });

  it('adds the flat increment at any higher price', () => {
    expect(minimumNextBid(1_000n, FLAT_DOLLAR_BAND)).toBe(1_100n);
    expect(minimumNextBid(999_999n, FLAT_DOLLAR_BAND)).toBe(1_000_099n);
  });

  it.each([
    { amount: 0n, expected: 100n },
    { amount: 4_999n, expected: 5_099n },
    { amount: 19_999n, expected: 20_499n },
    { amount: 20_000n, expected: 21_000n },
    { amount: 50_000n, expected: 51_000n },
  ])('picks the correct band for amount $amount', ({ amount, expected }) => {
    expect(minimumNextBid(amount, MULTI_BAND)).toBe(expected);
  });

  it('band selection does not depend on array order', () => {
    const shuffled = [...MULTI_BAND].reverse();
    expect(minimumNextBid(20_000n, shuffled)).toBe(21_000n);
  });

  it('boundary amount exactly at a band threshold uses that band, not the lower one', () => {
    expect(minimumNextBid(5_000n, MULTI_BAND)).toBe(5_500n);
  });

  it('throws if no band covers the amount (misconfiguration)', () => {
    const noZeroBand: readonly IncrementBand[] = [{ minAmount: 100n, incrementAmount: 100n }];
    expect(() => minimumNextBid(0n, noZeroBand)).toThrow();
  });
});
