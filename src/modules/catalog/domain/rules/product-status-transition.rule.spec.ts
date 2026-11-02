import { describe, expect, it } from 'vitest';
import {
  transitionProductStatus,
  ProductStatusTransitionAction,
} from './product-status-transition.rule';
import { ProductStatus } from '../entities/product.entity';

const ALL_STATUSES: readonly ProductStatus[] = ['DRAFT', 'ACTIVE', 'SOLD', 'ARCHIVED'];

const LEGAL_TRANSITIONS: ReadonlyArray<{
  action: ProductStatusTransitionAction;
  from: ProductStatus;
  to: ProductStatus;
}> = [
  { action: 'PUBLISH', from: 'DRAFT', to: 'ACTIVE' },
  { action: 'UNPUBLISH', from: 'ACTIVE', to: 'DRAFT' },
];

describe('transitionProductStatus', () => {
  it.each(LEGAL_TRANSITIONS)('allows $action from $from to $to', ({ action, from, to }) => {
    const result = transitionProductStatus(action, from);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe(to);
  });

  it.each(LEGAL_TRANSITIONS)(
    'rejects $action from every status except $from',
    ({ action, from }) => {
      for (const status of ALL_STATUSES) {
        if (status === from) continue;

        const result = transitionProductStatus(action, status);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('INVALID_PRODUCT_STATUS');
          expect(result.error.details).toEqual({ expected: from, actual: status });
        }
      }
    },
  );

  it('SOLD and ARCHIVED have no legal outbound transition', () => {
    for (const status of ['SOLD', 'ARCHIVED'] as const) {
      for (const action of LEGAL_TRANSITIONS.map((t) => t.action)) {
        expect(transitionProductStatus(action, status).ok).toBe(false);
      }
    }
  });
});
