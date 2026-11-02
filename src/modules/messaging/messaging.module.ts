import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { EventsModule } from '../../platform/events/events.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { SellersModule } from '../sellers/sellers.module';
import { IdentityModule } from '../identity/identity.module';
import { MESSAGING_REPOSITORY } from './domain/ports/messaging.repository.port';
import { MessagingPrismaRepository } from './infra/repositories/messaging.prisma.repository';
import { StartConversationUseCase } from './application/commands/start-conversation.usecase';
import { SendMessageUseCase } from './application/commands/send-message.usecase';
import { MarkConversationReadUseCase } from './application/commands/mark-conversation-read.usecase';
import { ListMyConversationsQuery } from './application/queries/list-my-conversations.query';
import { ListMessagesQuery } from './application/queries/list-messages.query';
import { MessagingService } from './application/messaging.service';
import { MessagingController } from './api/http/messaging.controller';
import { MessagingGateway } from './api/ws/messaging.gateway';

@Module({
  imports: [DatabaseModule, EventsModule, AuthModule, RateLimitModule, SellersModule, IdentityModule],
  controllers: [MessagingController],
  providers: [
    { provide: MESSAGING_REPOSITORY, useClass: MessagingPrismaRepository },
    StartConversationUseCase,
    SendMessageUseCase,
    MarkConversationReadUseCase,
    ListMyConversationsQuery,
    ListMessagesQuery,
    MessagingService,
    MessagingGateway,
  ],
  exports: [MessagingService],
})
export class MessagingModule {}
