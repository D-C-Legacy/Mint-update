import { SetMetadata } from '@nestjs/common';

export const SKIP_DEFAULT_RATE_LIMIT_KEY = 'skipDefaultRateLimit';

// For the rare route under a class-level DefaultRateLimitGuard/WsDefaultRateLimitGuard that
// already has its own, more specific scope checked at the use-case layer (e.g. sellers'
// upload-url route, under SellersController's class-level guard) — marks it exempt from the
// 100/min default so it isn't limited against two buckets at once. Routes with their own
// method-level @UseGuards() that simply never include the default guard don't need this; it
// only matters when a broader (class-level) guard would otherwise also apply.
export const SkipDefaultRateLimit = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_DEFAULT_RATE_LIMIT_KEY, true);
