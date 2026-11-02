import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { QueueModule } from '../../platform/queue/queue.module';
import { WebhooksModule } from '../../platform/webhooks/webhooks.module';
import { RedisModule } from '../../platform/redis/redis.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { EventsModule } from '../../platform/events/events.module';
import { ObservabilityModule } from '../../platform/observability/observability.module';
import { SellersModule } from '../sellers/sellers.module';
import { ChannelsModule } from '../channels/channels.module';
import { SalesModule } from '../sales/sales.module';
import { OrdersModule } from '../orders/orders.module';
import { ChatModule } from '../chat/chat.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CLOCK, SystemClock } from '../../shared/time/clock';
import { STREAM_SESSION_REPOSITORY } from './domain/ports/stream-session.repository.port';
import { STREAM_QUEUE_ITEM_REPOSITORY } from './domain/ports/stream-queue-item.repository.port';
import { STREAM_MODERATOR_REPOSITORY } from './domain/ports/stream-moderation.repository.port';
import { CHAT_TIMEOUT_REPOSITORY } from './domain/ports/stream-moderation.repository.port';
import { StreamQueueItemPrismaRepository } from './infra/repositories/stream-queue-item.prisma.repository';
import { STREAM_PROVIDER } from './domain/ports/stream-provider.port';
import { StreamSessionPrismaRepository } from './infra/repositories/stream-session.prisma.repository';
import { StreamModeratorPrismaRepository } from './infra/repositories/stream-moderator.prisma.repository';
import { ChatTimeoutPrismaRepository } from './infra/repositories/chat-timeout.prisma.repository';
import { LiveKitStreamProviderAdapter } from './infra/stream-provider.livekit.adapter';
import { IvsStreamProviderAdapter } from './infra/stream-provider.ivs.adapter';
import { streamConfig } from '../../config/stream.config';
import { StreamReconcileProcessor } from './infra/jobs/stream-reconcile.processor';
import { PresenceService } from './infra/presence.service';
import { SessionStatsFinalizer } from './application/session-stats-finalizer.service';
import { CreateSessionUseCase } from './application/commands/create-session.usecase';
import { StartSessionUseCase } from './application/commands/start-session.usecase';
import { EndSessionUseCase } from './application/commands/end-session.usecase';
import { KillSessionUseCase } from './application/commands/kill-session.usecase';
import { ReceiveProviderWebhookUseCase } from './application/commands/receive-provider-webhook.usecase';
import { AddModeratorUseCase } from './application/commands/add-moderator.usecase';
import { RemoveModeratorUseCase } from './application/commands/remove-moderator.usecase';
import { TimeoutUserUseCase } from './application/commands/timeout-user.usecase';
import { GetSessionForJoinQuery } from './application/queries/get-session-for-join.query';
import { GetViewerAccessQuery } from './application/queries/get-viewer-access.query';
import { AddQueueItemUseCase } from './application/commands/add-queue-item.usecase';
import { ReorderQueueItemsUseCase } from './application/commands/reorder-queue-items.usecase';
import { FeatureQueueItemUseCase } from './application/commands/feature-queue-item.usecase';
import { SpinQueueWheelUseCase } from './application/commands/spin-queue-wheel.usecase';
import { ToggleAutoQueueUseCase } from './application/commands/toggle-auto-queue.usecase';
import { AutoAdvanceQueueUseCase } from './application/commands/auto-advance-queue.usecase';
import { ListQueueItemsQuery } from './application/queries/list-queue-items.query';
import { ListLiveSessionsQuery } from './application/queries/list-live-sessions.query';
import { GetSessionDetailQuery } from './application/queries/get-session-detail.query';
import { ListModeratorsQueryImpl } from './application/queries/list-moderators.query';
import { ListTimeoutsQueryImpl } from './application/queries/list-timeouts.query';
import { StreamingService } from './application/streaming.service';
import { StreamingGateway } from './api/ws/streaming.gateway';
import { StreamsController } from './api/http/streams.controller';
import { SellerAnalyticsController } from './api/http/seller-analytics.controller';
import { GetSellerViewersSummaryQuery } from './application/queries/get-seller-viewers-summary.query';
import { StorageModule } from '../../platform/storage/storage.module';

// D-005 resolved 14 Oct 2026 (09-DECISIONS.md) — Amazon IVS. STREAM_PROVIDER picks the adapter at
// boot; both stay registered so a rollback to LiveKit is still just an env var away, same reason
// the port exists in the first place.
@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    WebhooksModule,
    RedisModule,
    AuthModule,
    RateLimitModule,
    SellersModule,
    ChannelsModule,
    SalesModule,
    OrdersModule,
    EventsModule,
    ObservabilityModule,
    StorageModule,
    CatalogModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [StreamsController, SellerAnalyticsController],
  providers: [
    { provide: STREAM_SESSION_REPOSITORY, useClass: StreamSessionPrismaRepository },
    { provide: STREAM_QUEUE_ITEM_REPOSITORY, useClass: StreamQueueItemPrismaRepository },
    { provide: STREAM_MODERATOR_REPOSITORY, useClass: StreamModeratorPrismaRepository },
    { provide: CHAT_TIMEOUT_REPOSITORY, useClass: ChatTimeoutPrismaRepository },
    {
      provide: STREAM_PROVIDER,
      useClass:
        streamConfig.provider === 'ivs' ? IvsStreamProviderAdapter : LiveKitStreamProviderAdapter,
    },
    { provide: CLOCK, useClass: SystemClock },
    CreateSessionUseCase,
    StartSessionUseCase,
    EndSessionUseCase,
    KillSessionUseCase,
    ReceiveProviderWebhookUseCase,
    AddModeratorUseCase,
    RemoveModeratorUseCase,
    TimeoutUserUseCase,
    GetSessionForJoinQuery,
    GetViewerAccessQuery,
    AddQueueItemUseCase,
    ReorderQueueItemsUseCase,
    FeatureQueueItemUseCase,
    SpinQueueWheelUseCase,
    ToggleAutoQueueUseCase,
    AutoAdvanceQueueUseCase,
    ListQueueItemsQuery,
    ListLiveSessionsQuery,
    GetSessionDetailQuery,
    GetSellerViewersSummaryQuery,
    ListModeratorsQueryImpl,
    ListTimeoutsQueryImpl,
    PresenceService,
    SessionStatsFinalizer,
    StreamingService,
    StreamReconcileProcessor,
    StreamingGateway,
  ],
  exports: [StreamingService],
})
export class StreamingModule {}
