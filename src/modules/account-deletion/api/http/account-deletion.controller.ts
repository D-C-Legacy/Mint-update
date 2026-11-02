import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IdentityService } from '../../../identity/application/identity.service';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { AccountDeletionEligibilityService } from '../../application/account-deletion-eligibility.service';
import { AccountDeletionBlockedError } from '../../domain/errors/account-deletion.errors';
import {
  RequestAccountDeletionSchema,
  RequestAccountDeletionDto,
} from './dto/request-account-deletion.dto';

// Apple App Store guideline 5.1.1(v) account-deletion feature (28 Oct 2026). Not in
// 05-API-SPEC.md — this whole feature is a user-directed addition. Lives in modules/account-
// deletion rather than identity/api/http/me.controller.ts because the request path needs the
// Sellers/Ledger/Orders eligibility check (see account-deletion-eligibility.service.ts for why
// that can't live inside IdentityModule); the paths still sit under /me for the client.
@Controller('me/delete-account')
export class AccountDeletionController {
  constructor(
    private readonly eligibility: AccountDeletionEligibilityService,
    private readonly identity: IdentityService,
  ) {}

  @Post()
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async requestDeletion(
    @Body(new ZodValidationPipe(RequestAccountDeletionSchema)) _dto: RequestAccountDeletionDto,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const blockers = await this.eligibility.findSellerBlockers({ userId: current.id });
    if (blockers.length > 0) {
      throw toHttpException(new AccountDeletionBlockedError(blockers));
    }

    const result = await this.identity.requestAccountDeletion({ userId: current.id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: { scheduledFor: result.value.scheduledFor.toISOString() } };
  }

  @Post('cancel')
  @HttpCode(200)
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async cancelDeletion(@CurrentUser() current: AuthenticatedUser): Promise<{ data: unknown }> {
    const result = await this.identity.cancelAccountDeletion({ userId: current.id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }
}
