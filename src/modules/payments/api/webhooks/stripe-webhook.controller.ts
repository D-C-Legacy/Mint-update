import { BadRequestException, Controller, HttpCode, Headers, Inject, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { PAYMENT_PROVIDER, PaymentProviderPort } from '../../domain/ports/payment-provider.port';
import { WebhookEventService } from '../../../../platform/webhooks/webhook-event.service';
import { QueueService } from '../../../../platform/queue/queue.service';
import { QueueNames } from '../../../../platform/queue/queue.names';
import { STRIPE_WEBHOOK_JOB } from '../../infra/jobs/stripe-webhook.processor';

// 05-API-SPEC.md §9's webhook-handling algorithm, steps 1-3, verbatim: verify the signature,
// reject anything unsigned -> insert into WebhookEvent with providerEventId unique, a duplicate
// insert means already seen, return 200 and stop -> enqueue processing, return 200 fast, never
// do ledger work inside the HTTP handler. Step 4 (the job applying the ledger transaction) is
// `StripeWebhookProcessor`'s job, not this controller's.
//
// Deliberately calls platform services directly rather than through a `PaymentsService` facade
// (the convention every other controller in this codebase follows) — there is no business
// decision here beyond the dedupe check the algorithm itself specifies, same "a dedicated
// use-case class would be pure ceremony" reasoning P2-06 used for `AdminService.recordAuditLog`.
// This ticket's own Touches column (`api/webhooks/**`, `infra/jobs/**`) names no
// `application/**` change, and none was needed.
@Controller('webhooks')
export class StripeWebhookController {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProviderPort,
    private readonly webhookEvents: WebhookEventService,
    private readonly queue: QueueService,
  ) {}

  @Post('stripe')
  @HttpCode(200)
  async handle(
    @Req() req: FastifyRequest & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    if (!req.rawBody) {
      // Genuinely unexpected, not a client error: every `main.*.ts` that serves HTTP registers
      // `registerRawBodyCapture` before `app.listen()` specifically so this is always present —
      // a miss here means that wiring broke, not that the request was malformed.
      throw new Error('Raw request body unavailable — raw-body content parser not registered');
    }

    // 1. Verify the signature. `verifyWebhookSignature` throws on an invalid signature. That is a
    // bad request from the caller, not a server fault, so it is turned into a 400 here: left
    // uncaught it would surface as a 500 (Stripe's error is not an HttpException) and page whoever
    // watches 5xx alerts for every junk request. Nothing is recorded or enqueued on this path.
    let event;
    try {
      event = this.paymentProvider.verifyWebhookSignature(req.rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid stripe-signature');
    }

    // 2. Dedupe insert.
    const { id, isNew } = await this.webhookEvents.recordIfNew({
      provider: 'stripe',
      providerEventId: event.providerEventId,
      type: event.type,
      payload: event.payload,
    });

    // 3. Enqueue and return fast — only for a genuinely new event; a duplicate delivery of one
    // already recorded must not enqueue (and therefore process) a second time.
    if (isNew) {
      await this.queue.enqueue(
        QueueNames.PAYMENTS,
        STRIPE_WEBHOOK_JOB,
        { webhookEventId: id, type: event.type, payload: event.payload },
        { jobId: id },
      );
    }

    return { received: true };
  }
}
