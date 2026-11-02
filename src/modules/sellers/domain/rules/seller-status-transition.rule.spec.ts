import { describe, expect, it } from 'vitest';
import { transitionSellerStatus, SellerTransitionAction } from './seller-status-transition.rule';
import { SellerStatus } from '../entities/seller.entity';

const ALL_STATUSES: readonly SellerStatus[] = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
];

describe('transitionSellerStatus', () => {
  const legalTransitions: ReadonlyArray<{
    action: SellerTransitionAction;
    from: SellerStatus;
    to: SellerStatus;
  }> = [
    { action: 'SUBMIT', from: 'DRAFT', to: 'PENDING_REVIEW' },
    { action: 'WITHDRAW', from: 'PENDING_REVIEW', to: 'DRAFT' },
    { action: 'APPROVE', from: 'PENDING_REVIEW', to: 'APPROVED' },
    { action: 'REJECT', from: 'PENDING_REVIEW', to: 'REJECTED' },
    { action: 'SUSPEND', from: 'APPROVED', to: 'SUSPENDED' },
    { action: 'REINSTATE', from: 'SUSPENDED', to: 'APPROVED' },
  ];

  it.each(legalTransitions)('allows $action from $from to $to', ({ action, from, to }) => {
    const result = transitionSellerStatus(action, from);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe(to);
  });

  it.each(legalTransitions)(
    'rejects $action from every status except $from',
    ({ action, from }) => {
      for (const status of ALL_STATUSES) {
        if (status === from) continue;

        const result = transitionSellerStatus(action, status);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('INVALID_SELLER_STATUS');
          expect(result.error.details).toEqual({ expected: from, actual: status });
        }
      }
    },
  );

  it('REJECTED has no legal outbound transition', () => {
    for (const action of legalTransitions.map((t) => t.action)) {
      const result = transitionSellerStatus(action, 'REJECTED');
      expect(result.ok).toBe(false);
    }
  });
});
