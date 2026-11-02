import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SellersService } from '../../application/sellers.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { SkipDefaultRateLimit } from '../../../../platform/rate-limit/skip-default-rate-limit.decorator';
import { SellerTeamGuard, SellerTeamRoles } from '../../../../platform/auth/seller-team.guard';
import { toHttpException } from '../../../../shared/errors/to-http-exception';
import { SaveApplicationSchema, SaveApplicationDto } from './dto/save-application.dto';
import { RequestUploadUrlSchema, RequestUploadUrlDto } from './dto/request-upload-url.dto';
import { AttachDocumentSchema, AttachDocumentDto } from './dto/attach-document.dto';
import { UpdateProfileSchema, UpdateProfileDto } from './dto/update-profile.dto';
import { BankAccountSchema, BankAccountDto } from './dto/bank-account.dto';
import {
  InviteTeamMemberSchema,
  InviteTeamMemberDto,
  UpdateTeamMemberRoleSchema,
  UpdateTeamMemberRoleDto,
  AcceptTeamInvitationSchema,
  AcceptTeamInvitationDto,
  ListTeamMembersQuerySchema,
  ListTeamMembersQueryDto,
  ListInvitationsQuerySchema,
  ListInvitationsQueryDto,
} from './dto/team-management.dto';

@Controller()
@UseGuards(JwtGuard, DefaultRateLimitGuard)
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  @Post('seller/application')
  async saveApplication(
    @Body(new ZodValidationPipe(SaveApplicationSchema)) dto: SaveApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.sellers.saveDraft({ userId: user.id, ...dto });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('seller/application/submit')
  @HttpCode(200)
  async submitApplication(@CurrentUser() user: AuthenticatedUser): Promise<{ data: unknown }> {
    const result = await this.sellers.submitApplication({ userId: user.id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  // Not in 05-API-SPEC.md §3 (no route was ever documented for withdraw) — added so the
  // WithdrawApplicationUseCase built in P2-03 is actually reachable. Mirrors /submit exactly.
  @Post('seller/application/withdraw')
  @HttpCode(200)
  async withdrawApplication(@CurrentUser() user: AuthenticatedUser): Promise<{ data: unknown }> {
    const result = await this.sellers.withdrawApplication({ userId: user.id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Get('seller/application')
  async getApplication(@CurrentUser() user: AuthenticatedUser): Promise<{ data: unknown }> {
    const result = await this.sellers.getMySeller({ userId: user.id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value.seller };
  }

  // Exempt from the class-level DefaultRateLimitGuard — RequestDocumentUploadUseCase already
  // checks the more specific "Upload URL requests: 20/min per user" scope itself.
  @Post('seller/documents/upload-url')
  @HttpCode(200)
  @SkipDefaultRateLimit()
  async requestDocumentUpload(
    @Body(new ZodValidationPipe(RequestUploadUrlSchema)) dto: RequestUploadUrlDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.sellers.requestDocumentUpload({
      userId: user.id,
      type: dto.type,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('seller/documents')
  async attachDocument(
    @Body(new ZodValidationPipe(AttachDocumentSchema)) dto: AttachDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.sellers.attachDocument({ userId: user.id, ...dto });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Delete('seller/documents/:id')
  @HttpCode(200)
  async removeDocument(
    @Param('id') documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.sellers.removeDocument({ userId: user.id, documentId });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  // The seller's own uploaded documents, so the app can show what's attached and remove one.
  @Get('seller/documents')
  async listMyDocuments(@CurrentUser() user: AuthenticatedUser): Promise<{ data: unknown }> {
    const result = await this.sellers.listMyDocuments({ userId: user.id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: { items: result.value } };
  }

  @Post('seller/bank-account')
  async saveBankAccount(
    @Body(new ZodValidationPipe(BankAccountSchema)) dto: BankAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.sellers.saveBankAccount({
      userId: user.id,
      accountHolder: dto.accountHolder,
      accountNumber: dto.accountNumber,
      country: dto.country,
      currency: dto.currency,
      ...(dto.bankName !== undefined ? { bankName: dto.bankName } : {}),
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Get('seller/profile')
  async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<{ data: unknown }> {
    const result = await this.sellers.getMySeller({ userId: user.id });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value.seller };
  }

  @Patch('seller/profile')
  async updateProfile(
    @Body(new ZodValidationPipe(UpdateProfileSchema)) dto: UpdateProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.sellers.updateProfile({ userId: user.id, ...dto });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  // Team management routes (not in 05-API-SPEC.md — new for seller team feature)
  @UseGuards(SellerTeamGuard)
  @SellerTeamRoles('OWNER', 'MANAGER')
  @Post('seller/team/invite')
  async inviteTeamMember(
    @Body(new ZodValidationPipe(InviteTeamMemberSchema)) dto: InviteTeamMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const seller = await this.sellers.getMySeller({ userId: user.id });
    if (!seller.ok) throw toHttpException(seller.error);
    const result = await this.sellers.inviteTeamMember({
      inviterUserId: user.id,
      sellerId: seller.value.seller.id,
      email: dto.email,
      role: dto.role,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @UseGuards(SellerTeamGuard)
  @SellerTeamRoles('OWNER', 'MANAGER', 'STAFF', 'VIEW_ONLY')
  @Get('seller/team')
  async listTeamMembers(
    @Query(new ZodValidationPipe(ListTeamMembersQuerySchema)) query: ListTeamMembersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const seller = await this.sellers.getMySeller({ userId: user.id });
    if (!seller.ok) throw toHttpException(seller.error);
    const page = await this.sellers.listTeamMembers({
      sellerId: seller.value.seller.id,
      cursor: query.cursor,
      limit: query.limit,
    });
    return { data: { items: page.items, nextCursor: page.nextCursor } };
  }

  @UseGuards(SellerTeamGuard)
  @SellerTeamRoles('OWNER', 'MANAGER')
  @Delete('seller/team/:memberId')
  @HttpCode(200)
  async removeTeamMember(
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const seller = await this.sellers.getMySeller({ userId: user.id });
    if (!seller.ok) throw toHttpException(seller.error);
    const result = await this.sellers.removeTeamMember({
      requesterUserId: user.id,
      sellerId: seller.value.seller.id,
      memberId,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @UseGuards(SellerTeamGuard)
  @SellerTeamRoles('OWNER')
  @Patch('seller/team/:memberId/role')
  async updateTeamMemberRole(
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(UpdateTeamMemberRoleSchema)) dto: UpdateTeamMemberRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const seller = await this.sellers.getMySeller({ userId: user.id });
    if (!seller.ok) throw toHttpException(seller.error);
    const result = await this.sellers.updateTeamMemberRole({
      requesterUserId: user.id,
      sellerId: seller.value.seller.id,
      memberId,
      role: dto.role,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @Post('seller/team/accept')
  async acceptTeamInvitation(
    @Body(new ZodValidationPipe(AcceptTeamInvitationSchema)) dto: AcceptTeamInvitationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const result = await this.sellers.acceptTeamInvitation({
      userId: user.id,
      token: dto.token,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }

  @UseGuards(SellerTeamGuard)
  @SellerTeamRoles('OWNER', 'MANAGER')
  @Get('seller/team/invitations')
  async listInvitations(
    @Query(new ZodValidationPipe(ListInvitationsQuerySchema)) query: ListInvitationsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const seller = await this.sellers.getMySeller({ userId: user.id });
    if (!seller.ok) throw toHttpException(seller.error);
    const page = await this.sellers.listInvitations({
      sellerId: seller.value.seller.id,
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
    return { data: { items: page.items, nextCursor: page.nextCursor } };
  }

  @UseGuards(SellerTeamGuard)
  @SellerTeamRoles('OWNER', 'MANAGER')
  @Delete('seller/team/invitations/:invitationId')
  @HttpCode(200)
  async cancelInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const seller = await this.sellers.getMySeller({ userId: user.id });
    if (!seller.ok) throw toHttpException(seller.error);
    const result = await this.sellers.cancelInvitation({
      requesterUserId: user.id,
      sellerId: seller.value.seller.id,
      invitationId,
    });
    if (!result.ok) throw toHttpException(result.error);
    return { data: result.value };
  }
}
