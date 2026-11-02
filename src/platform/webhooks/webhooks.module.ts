import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { WebhookEventService } from './webhook-event.service';

@Module({
  imports: [DatabaseModule],
  providers: [WebhookEventService],
  exports: [WebhookEventService],
})
export class WebhooksModule {}
