import { describe, expect, it } from 'vitest';
import { AuctionEntity, AuctionRules, AuctionSnapshot } from './auction.entity';
import { SaleStatus } from './sale.entity';

const RULES: AuctionRules = {
  incrementBands: [{ minAmount: 0n, incrementAmount: 100n }],
  antiSnipe: { windowSeconds: 10, extendBySeconds: 10, maxExtensions: 20 },
};

const NOW = new Date('2026-01-01T00:00:00.000Z');

function buildSnapshot(overrides: Partial<AuctionSnapshot> = {}): AuctionSnapshot {
  return {
    id: 'sale_1',
    status: 'OPEN',
    currentAmount: 1_000n,
    startAmount: 500n,
    endsAt: new Date('2026-01-01T00:01:00.000Z'), // 60s out — well outside the 10s anti-snipe window
    extensionCount: 0,
    currentLeaderUserId: 'usr_leader',
    ...overrides,
  };
}

describe('AuctionEntity.evaluateBid', () => {
  it.each<SaleStatus>(['CLOSING', 'RESOLVED', 'CANCELLED', 'EXPIRED'])(
    'rejects with SALE_NOT_OPEN when status is %s',
    (status) => {
      const entity = AuctionEntity.from(buildSnapshot({ status }));
      const result = entity.evaluateBid({ amount: 1_100n, bidderUserId: 'usr_bidder', now: NOW }, RULES);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('SALE_NOT_OPEN');
    },
  );

  it('rejects with SALE_ENDED when now is at or past endsAt, even if status is still OPEN', () => {
    const snapshot = buildSnapshot({ endsAt: new Date('2026-01-01T00:00:00.000Z') });
    const entity = AuctionEntity.from(snapshot);

    const result = entity.evaluateBid({ amount: 1_100n, bidderUserId: 'usr_bidder', now: NOW }, RULES);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SALE_ENDED');
  });

  it('accepts a bid placed just before endsAt', () => {
    const snapshot = buildSnapshot({ endsAt: new Date('2026-01-01T00:00:00.001Z') });
    const entity = AuctionEntity.from(snapshot);

    const result = entity.evaluateBid({ amount: 1_100n, bidderUserId: 'usr_bidder', now: NOW }, RULES);

    expect(result.ok).toBe(true);
  });

  // BID_BY_SELLER is no longer this entity's concern — see the BidRejection comment in
  // auction.entity.ts. Covered at the use-case level (place-bid.usecase.ts) via guardNotSeller().

  it('rejects with BIDDER_ALREADY_LEADING when the bidder already holds the lead', () => {
    const entity = AuctionEntity.from(buildSnapshot());
    const result = entity.evaluateBid({ amount: 1_100n, bidderUserId: 'usr_leader', now: NOW }, RULES);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('BIDDER_ALREADY_LEADING');
  });

  it('does not treat a null leader as "already leading" on the first-ever bid', () => {
    const entity = AuctionEntity.from(
      buildSnapshot({ currentAmount: null, currentLeaderUserId: null, startAmount: 500n }),
    );
    const result = entity.evaluateBid({ amount: 600n, bidderUserId: 'usr_bidder', now: NOW }, RULES);

    expect(result.ok).toBe(true);
  });

  it('rejects with BID_TOO_LOW when below currentAmount + increment, with correct details', () => {
    const entity = AuctionEntity.from(buildSnapshot({ currentAmount: 1_000n }));
    const result = entity.evaluateBid({ amount: 1_050n, bidderUserId: 'usr_bidder', now: NOW }, RULES);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BID_TOO_LOW');
      expect(result.error.details).toEqual({
        saleId: 'sale_1',
        minimumNext: '1100',
        currentAmount: '1000',
      });
    }
  });

  it('accepts a bid exactly at the minimum next amount', () => {
    const entity = AuctionEntity.from(buildSnapshot({ currentAmount: 1_000n }));
    const result = entity.evaluateBid({ amount: 1_100n, bidderUserId: 'usr_bidder', now: NOW }, RULES);

    expect(result.ok).toBe(true);
  });

  it('anchors on startAmount, not currentAmount, before any bid has been placed', () => {
    const entity = AuctionEntity.from(
      buildSnapshot({ currentAmount: null, currentLeaderUserId: null, startAmount: 5_000n }),
    );

    const tooLow = entity.evaluateBid({ amount: 5_050n, bidderUserId: 'usr_bidder', now: NOW }, RULES);
    expect(tooLow.ok).toBe(false);

    const accepted = entity.evaluateBid({ amount: 5_100n, bidderUserId: 'usr_bidder', now: NOW }, RULES);
    expect(accepted.ok).toBe(true);
  });

  it('extends the timer when the bid lands inside the anti-snipe window', () => {
    const snapshot = buildSnapshot({ endsAt: new Date('2026-01-01T00:00:05.000Z'), extensionCount: 0 });
    const entity = AuctionEntity.from(snapshot);

    const result = entity.evaluateBid({ amount: 1_100n, bidderUserId: 'usr_bidder', now: NOW }, RULES);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.shouldExtend).toBe(true);
      expect(result.value.newEndsAt).toEqual(new Date('2026-01-01T00:00:10.000Z'));
    }
  });

  it('does not extend when the bid lands outside the anti-snipe window', () => {
    const entity = AuctionEntity.from(buildSnapshot()); // endsAt 60s out, well outside the 10s window
    const result = entity.evaluateBid({ amount: 1_100n, bidderUserId: 'usr_bidder', now: NOW }, RULES);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.shouldExtend).toBe(false);
      expect(result.value.newEndsAt).toEqual(buildSnapshot().endsAt);
    }
  });

  it('refuses to extend once the extension cap is reached, still accepting the bid', () => {
    const snapshot = buildSnapshot({ endsAt: new Date('2026-01-01T00:00:05.000Z'), extensionCount: 20 });
    const entity = AuctionEntity.from(snapshot);

    const result = entity.evaluateBid({ amount: 1_100n, bidderUserId: 'usr_bidder', now: NOW }, RULES);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.shouldExtend).toBe(false);
    }
  });
});
