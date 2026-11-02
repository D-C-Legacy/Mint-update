import { Result, Ok, Err } from '../../../../shared/result/result';
import { InvalidOrderStatusError } from '../errors/orders.errors';
import { OrderStatus } from '../entities/order.entity';

export type OrderTransitionAction =
  | 'PAY'
  | 'SHIP'
  | 'CONFIRM_DELIVERY'
  | 'COMPLETE'
  | 'CANCEL'
  | 'REFUND'
  | 'DISPUTE';

interface Transition {
  readonly from: readonly OrderStatus[];
  readonly to: OrderStatus;
  readonly label: string;
}

// PAY/SHIP/CONFIRM_DELIVERY are the doc-backed happy path (03-DATA-MODEL.md §8's own enum order,
// 00-PRD.md §4.4's fulfilment steps). CANCEL's origin set is doc-backed too (05-API-SPEC.md §8:
// "Cancel before shipment" — PENDING_PAYMENT or PAID, never SHIPPED or later).
//
// COMPLETE/REFUND/DISPUTE are NOT doc-backed the same way: no doc anywhere states what triggers
// COMPLETED (00-PRD.md §4.4 step 4, "seller's balance moves from pending to available", reads
// like the ledger-side effect of this transition, not its cause — likely P7-05's job, unowned by
// name in any of the 65 tickets), and none defines which prior statuses REFUND or DISPUTE can
// legally fire from. The sets below are a reasoned, conservative default (REFUND from any
// post-payment status since a real return can happen after delivery; DISPUTE excludes COMPLETED
// since funds have already released by then) — flagged here and in MEMORY.md, not a confirmed
// business rule. Whichever ticket first calls these three should re-confirm the origin sets
// before relying on them, same treatment the bid increment and offer-expiry placeholders got.
//
// CANCELLED/REFUNDED/DISPUTED have no outbound transition in this table — same "terminal until
// a doc says otherwise" treatment as SellerStatus.REJECTED (P2-04). COMPLETED is the one
// exception: REFUND's origin set deliberately includes it (a return after fulfilment is a normal
// commerce case), so COMPLETED is not fully terminal here.
const TRANSITIONS: Record<OrderTransitionAction, Transition> = {
  PAY: { from: ['PENDING_PAYMENT'], to: 'PAID', label: 'pay the order' },
  SHIP: { from: ['PAID'], to: 'SHIPPED', label: 'ship the order' },
  CONFIRM_DELIVERY: { from: ['SHIPPED'], to: 'DELIVERED', label: 'confirm delivery' },
  COMPLETE: { from: ['DELIVERED'], to: 'COMPLETED', label: 'complete the order' },
  CANCEL: { from: ['PENDING_PAYMENT', 'PAID'], to: 'CANCELLED', label: 'cancel the order' },
  REFUND: { from: ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'], to: 'REFUNDED', label: 'refund the order' },
  DISPUTE: { from: ['PAID', 'SHIPPED', 'DELIVERED'], to: 'DISPUTED', label: 'dispute the order' },
};

export function transitionOrderStatus(
  action: OrderTransitionAction,
  currentStatus: OrderStatus,
): Result<OrderStatus, InvalidOrderStatusError> {
  const transition = TRANSITIONS[action];

  if (!transition.from.includes(currentStatus)) {
    return Err(new InvalidOrderStatusError(transition.label, transition.from, currentStatus));
  }

  return Ok(transition.to);
}
