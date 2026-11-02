import { describe, expect, it } from 'vitest';
import { transitionOrderStatus, OrderTransitionAction } from './order-status-transition.rule';
import { OrderStatus } from '../entities/order.entity';

const ALL_STATUSES: readonly OrderStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
  'DISPUTED',
];

describe('transitionOrderStatus', () => {
  const transitions: ReadonlyArray<{
    action: OrderTransitionAction;
    from: readonly OrderStatus[];
    to: OrderStatus;
  }> = [
    { action: 'PAY', from: ['PENDING_PAYMENT'], to: 'PAID' },
    { action: 'SHIP', from: ['PAID'], to: 'SHIPPED' },
    { action: 'CONFIRM_DELIVERY', from: ['SHIPPED'], to: 'DELIVERED' },
    { action: 'COMPLETE', from: ['DELIVERED'], to: 'COMPLETED' },
    { action: 'CANCEL', from: ['PENDING_PAYMENT', 'PAID'], to: 'CANCELLED' },
    { action: 'REFUND', from: ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'], to: 'REFUNDED' },
    { action: 'DISPUTE', from: ['PAID', 'SHIPPED', 'DELIVERED'], to: 'DISPUTED' },
  ];

  for (const { action, from, to } of transitions) {
    it(`allows ${action} from each of [${from.join(', ')}] to ${to}`, () => {
      for (const status of from) {
        const result = transitionOrderStatus(action, status);
        expect(result.ok).toBe(true);
        expect(result.ok && result.value).toBe(to);
      }
    });

    it(`rejects ${action} from every status not in [${from.join(', ')}]`, () => {
      for (const status of ALL_STATUSES) {
        if (from.includes(status)) continue;

        const result = transitionOrderStatus(action, status);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('INVALID_ORDER_STATUS');
          expect(result.error.details).toEqual({ expected: from, actual: status });
        }
      }
    });
  }

  it('CANCELLED, REFUNDED and DISPUTED have no legal outbound transition (COMPLETED can still be REFUNDed)', () => {
    const terminalStatuses: readonly OrderStatus[] = ['CANCELLED', 'REFUNDED', 'DISPUTED'];
    const allActions = transitions.map((t) => t.action);

    for (const status of terminalStatuses) {
      for (const action of allActions) {
        const result = transitionOrderStatus(action, status);
        expect(result.ok).toBe(false);
      }
    }
  });
});
