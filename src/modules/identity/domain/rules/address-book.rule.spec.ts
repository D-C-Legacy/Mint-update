import { describe, expect, it } from 'vitest';
import { MAX_ADDRESSES_PER_USER, hasRoomForAnotherAddress, shouldBecomeDefault } from './address-book.rule';

describe('hasRoomForAnotherAddress', () => {
  it('allows addresses below the cap', () => {
    expect(hasRoomForAnotherAddress(0)).toBe(true);
    expect(hasRoomForAnotherAddress(MAX_ADDRESSES_PER_USER - 1)).toBe(true);
  });

  it('refuses at and above the cap', () => {
    expect(hasRoomForAnotherAddress(MAX_ADDRESSES_PER_USER)).toBe(false);
    expect(hasRoomForAnotherAddress(MAX_ADDRESSES_PER_USER + 1)).toBe(false);
  });
});

describe('shouldBecomeDefault', () => {
  it('makes the first address the default even if not asked', () => {
    expect(shouldBecomeDefault(0, false)).toBe(true);
  });

  it('leaves later addresses alone unless asked', () => {
    expect(shouldBecomeDefault(2, false)).toBe(false);
    expect(shouldBecomeDefault(2, true)).toBe(true);
  });
});
