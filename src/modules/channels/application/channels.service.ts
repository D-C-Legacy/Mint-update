import { Injectable } from '@nestjs/common';
import { Result } from '../../../shared/result/result';
import { CreateChannelUseCase, CreateChannelCommand } from './commands/create-channel.usecase';
import { UpdateChannelUseCase, UpdateChannelCommand } from './commands/update-channel.usecase';
import {
  RequestChannelBannerUploadUseCase,
  RequestChannelBannerUploadCommand,
  RequestChannelBannerUploadResult,
} from './commands/request-channel-banner-upload.usecase';
import { FollowChannelUseCase, FollowChannelCommand } from './commands/follow-channel.usecase';
import {
  UnfollowChannelUseCase,
  UnfollowChannelCommand,
  UnfollowChannelResult,
} from './commands/unfollow-channel.usecase';
import {
  GetChannelBySlugQuery,
  GetChannelBySlugCommand,
} from './queries/get-channel-by-slug.query';
import { GetChannelByIdQuery, GetChannelByIdCommand } from './queries/get-channel-by-id.query';
import { ListFollowingQuery, ListFollowingCommand } from './queries/list-following.query';
import {
  ListPublicChannelsQuery,
  ListPublicChannelsCommand,
} from './queries/list-public-channels.query';
import {
  GetMyChannelQuery,
  GetMyChannelCommand,
  GetMyChannelResult,
} from './queries/get-my-channel.query';
import {
  ListChannelFollowerUserIdsQuery,
  ListChannelFollowerUserIdsCommand,
} from './queries/list-channel-follower-user-ids.query';
import { CursorPage } from '../../../shared/pagination/cursor';
import { Channel } from '../domain/entities/channel.entity';
import {
  ChannelNotFoundError,
  SellerProfileNotFoundError,
  UploadRateLimitedError,
} from '../domain/errors/channels.errors';
import { InvalidUploadError } from '../../../platform/storage/upload-policy';

@Injectable()
export class ChannelsService {
  constructor(
    private readonly createChannelUseCase: CreateChannelUseCase,
    private readonly updateChannelUseCase: UpdateChannelUseCase,
    private readonly requestChannelBannerUploadUseCase: RequestChannelBannerUploadUseCase,
    private readonly followChannelUseCase: FollowChannelUseCase,
    private readonly unfollowChannelUseCase: UnfollowChannelUseCase,
    private readonly getChannelBySlugQuery: GetChannelBySlugQuery,
    private readonly getChannelByIdQuery: GetChannelByIdQuery,
    private readonly listFollowingQuery: ListFollowingQuery,
    private readonly listPublicChannelsQuery: ListPublicChannelsQuery,
    private readonly getMyChannelQuery: GetMyChannelQuery,
    private readonly listChannelFollowerUserIdsQuery: ListChannelFollowerUserIdsQuery,
  ) {}

  async createChannel(cmd: CreateChannelCommand): Promise<Result<Channel, never>> {
    return this.createChannelUseCase.execute(cmd);
  }

  async updateChannel(
    cmd: UpdateChannelCommand,
  ): Promise<Result<Channel, SellerProfileNotFoundError | ChannelNotFoundError>> {
    return this.updateChannelUseCase.execute(cmd);
  }

  async requestBannerUpload(
    cmd: RequestChannelBannerUploadCommand,
  ): Promise<
    Result<
      RequestChannelBannerUploadResult,
      ChannelNotFoundError | UploadRateLimitedError | InvalidUploadError
    >
  > {
    return this.requestChannelBannerUploadUseCase.execute(cmd);
  }

  async followChannel(cmd: FollowChannelCommand): Promise<Result<Channel, ChannelNotFoundError>> {
    return this.followChannelUseCase.execute(cmd);
  }

  async unfollowChannel(
    cmd: UnfollowChannelCommand,
  ): Promise<Result<UnfollowChannelResult, never>> {
    return this.unfollowChannelUseCase.execute(cmd);
  }

  async getChannelBySlug(
    cmd: GetChannelBySlugCommand,
  ): Promise<Result<Channel, ChannelNotFoundError>> {
    return this.getChannelBySlugQuery.execute(cmd);
  }

  async getChannelById(cmd: GetChannelByIdCommand): Promise<Channel | null> {
    return this.getChannelByIdQuery.execute(cmd);
  }

  async listPublicChannels(cmd: ListPublicChannelsCommand): Promise<CursorPage<Channel>> {
    return this.listPublicChannelsQuery.execute(cmd);
  }

  async listFollowing(cmd: ListFollowingCommand): Promise<Result<CursorPage<Channel>, never>> {
    return this.listFollowingQuery.execute(cmd);
  }

  async getMyChannel(
    cmd: GetMyChannelCommand,
  ): Promise<Result<GetMyChannelResult, SellerProfileNotFoundError | ChannelNotFoundError>> {
    return this.getMyChannelQuery.execute(cmd);
  }

  async listFollowerUserIds(cmd: ListChannelFollowerUserIdsCommand): Promise<string[]> {
    return this.listChannelFollowerUserIdsQuery.execute(cmd);
  }
}
