import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IdentityService } from '../../application/identity.service';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { InvalidTokenError } from '../../domain/errors/identity.errors';
import { canAuthenticate, User, UserRole } from '../../domain/entities/user.entity';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { UpdateProfileSchema, UpdateProfileDto } from './dto/update-profile.dto';
import { RequestAvatarUploadSchema, RequestAvatarUploadDto } from './dto/request-avatar-upload.dto';
import { UpdatePreferencesSchema, UpdatePreferencesDto } from './dto/update-preferences.dto';
import { RegisterDeviceSchema, RegisterDeviceDto } from './dto/register-device.dto';

interface MeView {
  id: string;
  email: string;
  phone: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  emailVerifiedAt: string | null;
  deletionScheduledAt: string | null;
}

function toMeView(user: User): MeView {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    // Apple App Store guideline 5.1.1(v) account-deletion feature — the client gates its whole
    // shell on this being non-null (see modules/account-deletion).
    deletionScheduledAt: user.deletionScheduledAt ? user.deletionScheduledAt.toISOString() : null,
  };
}

// 05-API-SPEC.md §2: GET /me, "Current user profile". Returns only fields the backend stores;
// there is no handle or follower count on User, so neither is invented here.
@Controller()
export class MeController {
  constructor(private readonly identity: IdentityService) {}

  @Get('me')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async getMe(@CurrentUser() current: AuthenticatedUser): Promise<{ data: unknown }> {
    const user = await this.identity.getUserById({ userId: current.id });
    if (!user || !canAuthenticate(user.status)) {
      throw toHttpException(new InvalidTokenError());
    }
    return { data: toMeView(user) };
  }

  // `PATCH /me` (05-API-SPEC.md §2: "Update display name, avatar"). `avatarKey` is a storage key
  // from `POST /me/avatar/upload-url` below, not a raw URL.
  @Patch('me')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async updateMe(
    @Body(new ZodValidationPipe(UpdateProfileSchema)) dto: UpdateProfileDto,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.identity.updateProfile({
      userId: current.id,
      displayName: dto.displayName,
      ...(dto.avatarKey !== undefined ? { avatarKey: dto.avatarKey } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: toMeView(result.value) };
  }

  // Not individually in 05-API-SPEC.md (same as the product-image/seller-document/channel-banner
  // upload-url routes) but required to actually fulfill PATCH /me's documented avatar support.
  // No DefaultRateLimitGuard — the use case checks the narrower upload-url scope (20/min) itself.
  @Post('me/avatar/upload-url')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  async requestAvatarUpload(
    @Body(new ZodValidationPipe(RequestAvatarUploadSchema)) dto: RequestAvatarUploadDto,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.identity.requestAvatarUpload({
      userId: current.id,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  // Not in 05-API-SPEC.md: added for app integration Phase 2 on the user's instruction. A user who
  // never saved anything gets the defaults.
  @Get('me/preferences')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async getPreferences(@CurrentUser() current: AuthenticatedUser): Promise<{ data: unknown }> {
    return { data: await this.identity.getPreferences({ userId: current.id }) };
  }

  // A patch, not a full replace: the app saves one toggle at a time.
  @Patch('me/preferences')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async updatePreferences(
    @Body(new ZodValidationPipe(UpdatePreferencesSchema)) dto: UpdatePreferencesDto,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    return { data: await this.identity.updatePreferences({ userId: current.id, patch: dto }) };
  }

  // 05-API-SPEC.md §2: register a push token. Safe to repeat for the same token.
  @Post('me/devices')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async registerDevice(
    @Body(new ZodValidationPipe(RegisterDeviceSchema)) dto: RegisterDeviceDto,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const device = await this.identity.registerDevice({ userId: current.id, ...dto });
    return {
      data: {
        id: device.id,
        platform: device.platform,
        lastSeenAt: device.lastSeenAt.toISOString(),
      },
    };
  }

  // 05-API-SPEC.md §2: remove a push token.
  @Delete('me/devices/:id')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async removeDevice(
    @Param('id') id: string,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.identity.removeDevice({ userId: current.id, deviceId: id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }
}
