import { NestFastifyApplication } from '@nestjs/platform-fastify';

// Only one real caller today: Apple's Sign in with Apple web callback
// (POST /auth/apple/callback), which Apple requires to use response_mode=form_post — the
// authorization result arrives as application/x-www-form-urlencoded, not JSON. Fastify has no
// parser for that content type registered by default (bodyParser is disabled globally in
// main.api.ts for registerRawBodyCapture's sake), so without this the request would 415.
// Parses into a plain object exactly like the JSON parser does, so @Body() works unchanged.
export function registerFormBodyParser(app: NestFastifyApplication): void {
  app
    .getHttpAdapter()
    .getInstance()
    .addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string' },
      (_req, body: string, done) => {
        try {
          done(null, Object.fromEntries(new URLSearchParams(body)));
        } catch (err) {
          done(err as Error, undefined);
        }
      },
    );
}
