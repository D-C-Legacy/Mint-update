import { Refund, RefundStatus } from '../entities/refund.entity';

export const REFUND_REPOSITORY = Symbol('RefundRepositoryPort');

export interface CreateRefundInput {
  readonly id: string;
  readonly paymentId: string;
  readonly providerRefundId: string;
  readonly amount: bigint;
  readonly reason: string;
  readonly status: RefundStatus;
  readonly initiatedByUserId: string | null;
}

export interface RefundRepositoryPort {
  create(input: CreateRefundInput): Promise<Refund>;
  findByProviderRefundId(providerRefundId: string): Promise<Refund | null>;
  updateStatus(id: string, status: RefundStatus): Promise<Refund>;
  /** Sum of every SUCCEEDED refund already recorded against this payment — used to compute how
   *  much is still refundable before issuing a new one. */
  sumSucceededByPaymentId(paymentId: string): Promise<bigint>;
}
