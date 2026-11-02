import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ChannelsService } from '../../application/channels.service';
import { StorageService } from '../../../../platform/storage/storage.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { SkipDefaultRateLimit } from '../../../../platform/rate-limit/skip-default-rate-limit.decorator';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { UpdateChannelSchema, UpdateChannelDto } from './dto/update-channel.dto';
import {
  RequestChannelBannerUploadSchema,
  RequestChannelBannerUploadDto,
} from './dto/request-channel-banner-upload.dto';
import { ListFollowingQuerySchema, ListFollowingQueryDto } from './dto/list-following-query.dto';
import {
  ListPublicChannelsQuerySchema,
  ListPublicChannelsQueryDto,
} from './dto/list-public-channels-query.dto';
import { toPublicChannelView } from './channel.view';

@Controller()
export class ChannelsController {
  constructor(
    private readonly channels: ChannelsService,
    private readonly storage: StorageService,
  ) {}

  @Get('channels')
  async listChannels(
    @Query(new ZodValidationPipe(ListPublicChannelsQuerySchema)) query: ListPublicChannelsQueryDto,
  ): Promise<{ data: unknown }> {
    const page = await this.channels.listPublicChannels({
      sellerId: query.sellerId,
      cursor: query.cursor,
      limit: query.limit,
    });
    const bannerUrlFor = (key: string): string => this.storage.getPublicUrl(key);
    return {
      data: {
        items: page.items.map((channel) => toPublicChannelView(channel, bannerUrlFor)),
        nextCursor: page.nextCursor,
      },
    };
  }

  @Get('channels/:slug')
  async getChannel(@Param('slug') slug: string): Promise<{ data: unknown }> {
    const result = await this.channels.getChannelBySlug({ slug });
    if (!result.ok) throw toHttpException(result.error);
    const bannerUrlFor = (key: string): string => this.storage.getPublicUrl(key);
    return { data: toPublicChannelView(result.value, bannerUrlFor) };
  }

  @Patch('channel')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async updateChannel(
    @Body(new ZodValidationPipe(UpdateChannelSchema)) dto: UpdateChannelDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.channels.updateChannel({
      userId: user.id,
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
      ...(dto.bannerKey !== undefined ? { bannerKey: dto.bannerKey } : {}),
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  // Exempt from the class-level guard's default rate limit — the use case checks the narrower
  // upload-url scope (20/min per user) itself.
  @Post('channel/banner/upload-url')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  @SkipDefaultRateLimit()
  async requestBannerUpload(
    @Body(new ZodValidationPipe(RequestChannelBannerUploadSchema))
    dto: RequestChannelBannerUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.channels.requestBannerUpload({
      userId: user.id,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('channels/:id/follow')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async follow(
    @Param('id') channelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.channels.followChannel({ userId: user.id, channelId });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Delete('channels/:id/follow')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async unfollow(
    @Param('id') channelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.channels.unfollowChannel({ userId: user.id, channelId });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Get('me/following')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async listFollowing(
    @Query(new ZodValidationPipe(ListFollowingQuerySchema)) query: ListFollowingQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.channels.listFollowing({
      userId: user.id,
      cursor: query.cursor,
      limit: query.limit,
    });
    if (!result.ok) throw toHttpException(result.error);
    const bannerUrlFor = (key: string): string => this.storage.getPublicUrl(key);
    return {
      data: {
        items: result.value.items.map((channel) => toPublicChannelView(channel, bannerUrlFor)),
        nextCursor: result.value.nextCursor,
      },
    };
  }
}
