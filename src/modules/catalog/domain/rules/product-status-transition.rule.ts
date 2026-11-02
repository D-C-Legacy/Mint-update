import { Result, Ok, Err } from '../../../../shared/result/result';
import { InvalidProductStatusError } from '../errors/catalog.errors';
import { ProductStatus } from '../entities/product.entity';

// Table-driven pure function, mirroring seller-status-transition.rule.ts exactly: one function for
// every action, so "which transitions exist" is auditable at a glance rather than scattered across
// separate use-case bodies. Only DRAFT<->ACTIVE is legal; SOLD and ARCHIVED are terminal here
// (archive is a separate action, and SOLD is set by the order flow).
export type ProductStatusTransitionAction = 'PUBLISH' | 'UNPUBLISH';

interface Transition {
  readonly from: ProductStatus;
  readonly to: ProductStatus;
  readonly label: string;
}

const TRANSITIONS: Record<ProductStatusTransitionAction, Transition> = {
  PUBLISH: { from: 'DRAFT', to: 'ACTIVE', label: 'publish the product' },
  UNPUBLISH: { from: 'ACTIVE', to: 'DRAFT', label: 'unpublish the product' },
};

export function transitionProductStatus(
  action: ProductStatusTransitionAction,
  currentStatus: ProductStatus,
): Result<ProductStatus, InvalidProductStatusError> {
  const transition = TRANSITIONS[action];

  if (transition.from !== currentStatus) {
    return Err(new InvalidProductStatusError(transition.label, transition.from, currentStatus));
  }

  return Ok(transition.to);
}
