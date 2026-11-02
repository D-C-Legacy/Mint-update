import { Result, Ok, Err } from '../../../../shared/result/result';
import { InvalidSellerStatusError } from '../errors/sellers.errors';
import { SellerStatus } from '../entities/seller.entity';

export type SellerTransitionAction = 'SUBMIT' | 'WITHDRAW' | 'APPROVE' | 'REJECT' | 'SUSPEND' | 'REINSTATE';

interface Transition {
  readonly from: SellerStatus;
  readonly to: SellerStatus;
  readonly label: string;
}

const TRANSITIONS: Record<SellerTransitionAction, Transition> = {
  SUBMIT: { from: 'DRAFT', to: 'PENDING_REVIEW', label: 'submit the application' },
  WITHDRAW: { from: 'PENDING_REVIEW', to: 'DRAFT', label: 'withdraw the application' },
  APPROVE: { from: 'PENDING_REVIEW', to: 'APPROVED', label: 'approve the application' },
  REJECT: { from: 'PENDING_REVIEW', to: 'REJECTED', label: 'reject the application' },
  SUSPEND: { from: 'APPROVED', to: 'SUSPENDED', label: 'suspend the seller' },
  REINSTATE: { from: 'SUSPENDED', to: 'APPROVED', label: 'reinstate the seller' },
};

export function transitionSellerStatus(
  action: SellerTransitionAction,
  currentStatus: SellerStatus,
): Result<SellerStatus, InvalidSellerStatusError> {
  const transition = TRANSITIONS[action];

  if (transition.from !== currentStatus) {
    return Err(new InvalidSellerStatusError(transition.label, transition.from, currentStatus));
  }

  return Ok(transition.to);
}
