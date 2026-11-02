import { NestFastifyApplication } from '@nestjs/platform-fastify';

// Stripe's (and any other provider's) webhook signature is an HMAC over the exact raw request
// bytes — Fastify's default JSON parser discards those bytes the moment it parses them, which
// would make `PaymentProviderPort.verifyWebhookSignature` fail on every real delivery. This
// overrides the global `application/json` parser to capture the raw buffer onto `req.rawBody`
// first, then parses it exactly as before — every existing route's `@Body()` keeps working
// unchanged, only webhook routes need to actually read `req.rawBody`.
export function registerRawBodyCapture(app: NestFastifyApplication): void {
  app.getHttpAdapter().getInstance().addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body: Buffer, done) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = body;
      if (body.length === 0) {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(body.toString('utf8')));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );
}
