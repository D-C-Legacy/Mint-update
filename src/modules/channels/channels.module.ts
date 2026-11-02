import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { EventsModule } from '../../platform/events/events.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { SellersModule } from '../sellers/sellers.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { ListPublicChannelsQuery } from './application/queries/list-public-channels.query';
import { CHANNEL_REPOSITORY } from './domain/ports/channel.repository.port';
import { ChannelPrismaRepository } from './infra/repositories/channel.prisma.repository';
import { CreateChannelUseCase } from './application/commands/create-channel.usecase';
import { UpdateChannelUseCase } from './application/commands/update-channel.usecase';
import { RequestChannelBannerUploadUseCase } from './application/commands/request-channel-banner-upload.usecase';
import { FollowChannelUseCase } from './application/commands/follow-channel.usecase';
import { UnfollowChannelUseCase } from './application/commands/unfollow-channel.usecase';
import { GetChannelBySlugQuery } from './application/queries/get-channel-by-slug.query';
import { GetChannelByIdQuery } from './application/queries/get-channel-by-id.query';
import { ListFollowingQuery } from './application/queries/list-following.query';
import { GetMyChannelQuery } from './application/queries/get-my-channel.query';
import { ListChannelFollowerUserIdsQuery } from './application/queries/list-channel-follower-user-ids.query';
import { ChannelsService } from './application/channels.service';
import { SellerApprovedHandler } from './events/handlers/seller-approved.handler';
import { ChannelsController } from './api/http/channels.controller';

@Module({
  imports: [
    DatabaseModule,
    EventsModule,
    AuthModule,
    RateLimitModule,
    // forwardRef: breaks the Sellers ↔ Notifications ↔ Channels module cycle (see sellers.module.ts).
    forwardRef(() => SellersModule),
    StorageModule,
  ],
  controllers: [ChannelsController],
  providers: [
    { provide: CHANNEL_REPOSITORY, useClass: ChannelPrismaRepository },
    CreateChannelUseCase,
    UpdateChannelUseCase,
    RequestChannelBannerUploadUseCase,
    FollowChannelUseCase,
    UnfollowChannelUseCase,
    GetChannelBySlugQuery,
    GetChannelByIdQuery,
    ListFollowingQuery,
    ListPublicChannelsQuery,
    GetMyChannelQuery,
    ListChannelFollowerUserIdsQuery,
    ChannelsService,
    SellerApprovedHandler,
  ],
  exports: [ChannelsService],
})
export class ChannelsModule {}
