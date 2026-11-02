import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service';

// First @Global() module in this codebase — flagged, not a default. Logging is the one platform
// concern genuinely needed by every module at every layer (domain rules excepted, which stay pure
// per AGENTS.md §4), unlike auth/rate-limit/idempotency which only matter to modules with HTTP/WS
// surfaces. Making every future module import LoggerModule explicitly for a cross-cutting concern
// this universal would be pure ceremony — @Global() is the one place in this build where that
// precedent is a cost, not a benefit.
@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
