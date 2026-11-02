import { Inject, Injectable } from '@nestjs/common';
import { Result } from '../../../shared/result/result';
import { PayOrderUseCase, PayOrderCommand, PayOrderResult } from './commands/pay-order.usecase';
import {
  RefundPaymentUseCase,
  RefundPaymentCommand,
  RefundPaymentResult,
} from './commands/refund-payment.usecase';
import {
  ApplyProviderEventUseCase,
  ApplyProviderEventCommand,
  ApplyProviderEventOutcome,
} from './commands/apply-provider-event.usecase';
import {
  CreateSetupIntentUseCase,
  ListPaymentMethodsUseCase,
  RemovePaymentMethodUseCase,
  SetupIntentResult,
} from './commands/saved-cards.usecases';
import {
  SavedPaymentMethod,
  PAYMENT_PROVIDER,
  PaymentProviderPort,
  ProcessorCashBalance,
} from '../domain/ports/payment-provider.port';
import {
  PaymentMethodNotFoundError,
  OrderNotFoundError,
  OrderNotPayableError,
  PaymentNotFoundError,
  PaymentNotSucceededError,
  RefundExceedsRemainingError,
  IdempotencyKeyRequiredError,
} from '../domain/errors/payments.errors';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly payOrderUseCase: PayOrderUseCase,
    private readonly refundPaymentUseCase: RefundPaymentUseCase,
    private readonly applyProviderEventUseCase: ApplyProviderEventUseCase,
    private readonly createSetupIntentUseCase: CreateSetupIntentUseCase,
    private readonly listPaymentMethodsUseCase: ListPaymentMethodsUseCase,
    private readonly removePaymentMethodUseCase: RemovePaymentMethodUseCase,
    // Straight port read-through, not a use-case: the reconciliation's 3rd check (ledger, 3c)
    // only needs the processor's raw cash position — no domain command or policy around it.
    // Injecting the port here keeps cross-module consumers (ledger, admin) on application-service
    // entry points per AGENTS.md §4.
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProviderPort,
  ) {}

  // Real processor cash per currency (Stripe balance, available + pending) for the ledger
  // reconciliation's 3rd check. Throws on Stripe faults — the check must never fake a comparison.
  async getProcessorCashBalances(): Promise<readonly ProcessorCashBalance[]> {
    return this.provider.fetchProcessorBalances();
  }

  async payOrder(
    cmd: PayOrderCommand,
  ): Promise<
    Result<
      PayOrderResult,
      | OrderNotFoundError
      | OrderNotPayableError
      | IdempotencyKeyRequiredError
      | PaymentMethodNotFoundError
    >
  > {
    return this.payOrderUseCase.execute(cmd);
  }

  async createSetupIntent(cmd: { userId: string }): Promise<SetupIntentResult> {
    return this.createSetupIntentUseCase.execute(cmd);
  }

  async listPaymentMethods(cmd: { userId: string }): Promise<SavedPaymentMethod[]> {
    return this.listPaymentMethodsUseCase.execute(cmd);
  }

  async removePaymentMethod(cmd: {
    userId: string;
    paymentMethodId: string;
  }): Promise<Result<{ removed: true }, PaymentMethodNotFoundError>> {
    return this.removePaymentMethodUseCase.execute(cmd);
  }

  async applyProviderEvent(cmd: ApplyProviderEventCommand): Promise<ApplyProviderEventOutcome> {
    return this.applyProviderEventUseCase.execute(cmd);
  }

  async refundPayment(
    cmd: RefundPaymentCommand,
  ): Promise<
    Result<
      RefundPaymentResult,
      | OrderNotFoundError
      | PaymentNotFoundError
      | PaymentNotSucceededError
      | RefundExceedsRemainingError
    >
  > {
    return this.refundPaymentUseCase.execute(cmd);
  }
}
