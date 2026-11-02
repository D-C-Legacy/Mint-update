import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { QueueModule } from '../../platform/queue/queue.module';
import { RedisModule } from '../../platform/redis/redis.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { EventsModule } from '../../platform/events/events.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { ObservabilityModule } from '../../platform/observability/observability.module';
import { StreamingModule } from '../streaming/streaming.module';
import { IdentityModule } from '../identity/identity.module';
import { CHAT_MESSAGE_REPOSITORY } from './domain/ports/chat-message.repository.port';
import { CHAT_BAN_REPOSITORY } from './domain/ports/chat-ban.repository.port';
import { ChatMessagePrismaRepository } from './infra/repositories/chat-message.prisma.repository';
import { ChatBanPrismaRepository } from './infra/repositories/chat-ban.prisma.repository';
import { ChatCacheService } from './infra/chat-cache.service';
import { ChatBanCacheService } from './infra/chat-ban-cache.service';
import { PersistChatMessageProcessor } from './infra/jobs/persist-chat-message.processor';
import { SendMessageUseCase } from './application/commands/send-message.usecase';
import { DeleteMessageUseCase } from './application/commands/delete-message.usecase';
import { BanUserUseCase } from './application/commands/ban-user.usecase';
import { UnbanUserUseCase } from './application/commands/unban-user.usecase';
import { ChatService } from './application/chat.service';
import { ChatGateway } from './api/ws/chat.gateway';

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    RedisModule,
    RateLimitModule,
    EventsModule,
    AuthModule,
    ObservabilityModule,
    IdentityModule,
    forwardRef(() => StreamingModule),
  ],
  providers: [
    { provide: CHAT_MESSAGE_REPOSITORY, useClass: ChatMessagePrismaRepository },
    { provide: CHAT_BAN_REPOSITORY, useClass: ChatBanPrismaRepository },
    ChatCacheService,
    ChatBanCacheService,
    SendMessageUseCase,
    DeleteMessageUseCase,
    BanUserUseCase,
    UnbanUserUseCase,
    ChatService,
    PersistChatMessageProcessor,
    ChatGateway,
  ],
  exports: [ChatService],
})
export class ChatModule {}
