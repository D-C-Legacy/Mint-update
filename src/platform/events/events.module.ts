import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { EVENT_BUS } from '../../shared/events/event-bus.port';
import { EventBusService } from './event-bus.service';

@Module({
  imports: [RedisModule],
  providers: [{ provide: EVENT_BUS, useClass: EventBusService }],
  exports: [EVENT_BUS],
})
export class EventsModule {}
