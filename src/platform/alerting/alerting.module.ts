import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { QueueModule } from '../queue/queue.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { NotificationsModule } from '../../modules/notifications/notifications.module';
import { AlertingService } from './alerting.service';
import { AlertSweepProcessor } from './alert-sweep.processor';

// Wired into app.module.ts directly (not deferred to a later ticket) — `AlertSweepProcessor`'s
// constructor needs to run and its `onModuleInit` needs to register the repeating sweep job at
// real process boot, same "the job/handler needs to be live at boot" reasoning as every other
// first-ticket-for-a-processor module in this build (SalesModule, ChannelsModule's event handler).
@Module({
  imports: [RedisModule, QueueModule, WebhooksModule, NotificationsModule],
  providers: [AlertingService, AlertSweepProcessor],
  exports: [AlertingService],
})
export class AlertingModule {}
