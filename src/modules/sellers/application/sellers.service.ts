import { Injectable } from '@nestjs/common';
import { Result } from '../../../shared/result/result';
import { SaveDraftUseCase, SaveDraftCommand, SaveDraftResult } from './commands/save-draft.usecase';
import {
  RequestDocumentUploadUseCase,
  RequestDocumentUploadCommand,
  RequestDocumentUploadResult,
} from './commands/request-document-upload.usecase';
import {
  AttachDocumentUseCase,
  AttachDocumentCommand,
  AttachDocumentResult,
} from './commands/attach-document.usecase';
import {
  SubmitApplicationUseCase,
  SubmitApplicationCommand,
  SubmitApplicationResult,
} from './commands/submit-application.usecase';
import {
  WithdrawApplicationUseCase,
  WithdrawApplicationCommand,
  WithdrawApplicationResult,
} from './commands/withdraw-application.usecase';
import {
  ApproveApplicationUseCase,
  ApproveApplicationCommand,
  ApproveApplicationResult,
} from './commands/approve-application.usecase';
import {
  RejectApplicationUseCase,
  RejectApplicationCommand,
  RejectApplicationResult,
} from './commands/reject-application.usecase';
import {
  SuspendSellerUseCase,
  SuspendSellerCommand,
  SuspendSellerResult,
} from './commands/suspend-seller.usecase';
import {
  ReinstateSellerUseCase,
  ReinstateSellerCommand,
  ReinstateSellerResult,
} from './commands/reinstate-seller.usecase';
import {
  UpdateProfileUseCase,
  UpdateProfileCommand,
  UpdateProfileResult,
} from './commands/update-profile.usecase';
import {
  UpdateCommissionUseCase,
  UpdateCommissionCommand,
  UpdateCommissionResult,
} from './commands/update-commission.usecase';
import {
  RemoveDocumentUseCase,
  RemoveDocumentCommand,
  RemoveDocumentResult,
} from './commands/remove-document.usecase';
import {
  SaveBankAccountUseCase,
  SaveBankAccountCommand,
  SaveBankAccountResult,
} from './commands/save-bank-account.usecase';
import {
  GetMySellerQuery,
  GetMySellerCommand,
  GetMySellerResult,
} from './queries/get-my-seller.query';
import { GetSellerByIdQuery, GetSellerByIdCommand } from './queries/get-seller-by-id.query';
import { ListApplicationsQuery, ListApplicationsCommand } from './queries/list-applications.query';
import {
  GetApplicationDetailQuery,
  GetApplicationDetailCommand,
} from './queries/get-application-detail.query';
import {
  GetDocumentDownloadUrlQuery,
  GetDocumentDownloadUrlCommand,
  GetDocumentDownloadUrlResult,
} from './queries/get-document-download-url.query';
import { ListMyDocumentsQuery, ListMyDocumentsCommand } from './queries/list-my-documents.query';
import {
  ListTeamMembersQueryImpl,
  ListTeamMembersCommand,
} from './queries/list-team-members.query';
import { ListInvitationsQueryImpl, ListInvitationsCommand } from './queries/list-invitations.query';
import {
  InviteTeamMemberUseCase,
  InviteTeamMemberCommand,
  InviteTeamMemberResult,
} from './commands/invite-team-member.usecase';
import {
  RemoveTeamMemberUseCase,
  RemoveTeamMemberCommand,
  RemoveTeamMemberResult,
} from './commands/remove-team-member.usecase';
import {
  UpdateTeamMemberRoleUseCase,
  UpdateTeamMemberRoleCommand,
  UpdateTeamMemberRoleResult,
} from './commands/update-team-member-role.usecase';
import {
  AcceptTeamInvitationUseCase,
  AcceptTeamInvitationCommand,
  AcceptTeamInvitationResult,
} from './commands/accept-team-invitation.usecase';
import {
  CancelInvitationUseCase,
  CancelInvitationCommand,
  CancelInvitationResult,
} from './commands/cancel-invitation.usecase';
import { CursorPage } from '../../../shared/pagination/cursor';
import {
  SellerTeamMember,
  SellerInvitation,
  SellerTeamRole,
} from '../domain/entities/seller-team.entity';
// Re-export so platform-safe code (SellerTeamGuard, seller-team.guard.ts) can reference the team
// role type through this application facade — the only seller-module import path the boundary
// rule allows outside infra.
export type { SellerTeamRole } from '../domain/entities/seller-team.entity';
import { InvalidUploadError } from '../../../platform/storage/upload-policy';
import { Seller } from '../domain/entities/seller.entity';
import {
  SellerApplicationDetail,
  SellerApplicationDocumentSummary,
  SellerApplicationSummary,
} from '../domain/entities/seller-application-summary.entity';
import {
  InvalidSellerStatusError,
  SellerApplicationNotFoundError,
  SellerDocumentNotFoundError,
  SellerTeamMemberNotFoundError,
  CannotRemoveOwnerError,
  CannotDemoteOwnerError,
  InsufficientTeamRoleError,
  SellerInvitationNotFoundError,
  SellerInvitationExpiredError,
  SellerInvitationAlreadyAcceptedError,
  SellerInvitationCancelledError,
  SellerTeamMemberAlreadyExistsError,
  CannotInviteSelfError,
  SellerInvitationAlreadyExistsError,
  UploadRateLimitedError,
  InvalidStorageKeyError,
} from '../domain/errors/sellers.errors';

@Injectable()
export class SellersService {
  constructor(
    private readonly saveDraftUseCase: SaveDraftUseCase,
    private readonly requestDocumentUploadUseCase: RequestDocumentUploadUseCase,
    private readonly attachDocumentUseCase: AttachDocumentUseCase,
    private readonly submitApplicationUseCase: SubmitApplicationUseCase,
    private readonly withdrawApplicationUseCase: WithdrawApplicationUseCase,
    private readonly approveApplicationUseCase: ApproveApplicationUseCase,
    private readonly rejectApplicationUseCase: RejectApplicationUseCase,
    private readonly suspendSellerUseCase: SuspendSellerUseCase,
    private readonly reinstateSellerUseCase: ReinstateSellerUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly updateCommissionUseCase: UpdateCommissionUseCase,
    private readonly removeDocumentUseCase: RemoveDocumentUseCase,
    private readonly saveBankAccountUseCase: SaveBankAccountUseCase,
    private readonly getMySellerQuery: GetMySellerQuery,
    private readonly getSellerByIdQuery: GetSellerByIdQuery,
    private readonly listApplicationsQuery: ListApplicationsQuery,
    private readonly getApplicationDetailQuery: GetApplicationDetailQuery,
    private readonly getDocumentDownloadUrlQuery: GetDocumentDownloadUrlQuery,
    private readonly listMyDocumentsQuery: ListMyDocumentsQuery,
    private readonly inviteTeamMemberUseCase: InviteTeamMemberUseCase,
    private readonly removeTeamMemberUseCase: RemoveTeamMemberUseCase,
    private readonly updateTeamMemberRoleUseCase: UpdateTeamMemberRoleUseCase,
    private readonly acceptTeamInvitationUseCase: AcceptTeamInvitationUseCase,
    private readonly cancelInvitationUseCase: CancelInvitationUseCase,
    private readonly listTeamMembersQuery: ListTeamMembersQueryImpl,
    private readonly listInvitationsQuery: ListInvitationsQueryImpl,
  ) {}

  async saveDraft(
    cmd: SaveDraftCommand,
  ): Promise<Result<SaveDraftResult, InvalidSellerStatusError>> {
    return this.saveDraftUseCase.execute(cmd);
  }

  async requestDocumentUpload(
    cmd: RequestDocumentUploadCommand,
  ): Promise<
    Result<
      RequestDocumentUploadResult,
      | SellerApplicationNotFoundError
      | InvalidSellerStatusError
      | UploadRateLimitedError
      | InvalidUploadError
    >
  > {
    return this.requestDocumentUploadUseCase.execute(cmd);
  }

  async attachDocument(
    cmd: AttachDocumentCommand,
  ): Promise<
    Result<
      AttachDocumentResult,
      SellerApplicationNotFoundError | InvalidSellerStatusError | InvalidStorageKeyError
    >
  > {
    return this.attachDocumentUseCase.execute(cmd);
  }

  async submitApplication(
    cmd: SubmitApplicationCommand,
  ): Promise<
    Result<SubmitApplicationResult, SellerApplicationNotFoundError | InvalidSellerStatusError>
  > {
    return this.submitApplicationUseCase.execute(cmd);
  }

  async withdrawApplication(
    cmd: WithdrawApplicationCommand,
  ): Promise<
    Result<WithdrawApplicationResult, SellerApplicationNotFoundError | InvalidSellerStatusError>
  > {
    return this.withdrawApplicationUseCase.execute(cmd);
  }

  async approveApplication(
    cmd: ApproveApplicationCommand,
  ): Promise<
    Result<ApproveApplicationResult, SellerApplicationNotFoundError | InvalidSellerStatusError>
  > {
    return this.approveApplicationUseCase.execute(cmd);
  }

  async rejectApplication(
    cmd: RejectApplicationCommand,
  ): Promise<
    Result<RejectApplicationResult, SellerApplicationNotFoundError | InvalidSellerStatusError>
  > {
    return this.rejectApplicationUseCase.execute(cmd);
  }

  async suspendSeller(
    cmd: SuspendSellerCommand,
  ): Promise<
    Result<SuspendSellerResult, SellerApplicationNotFoundError | InvalidSellerStatusError>
  > {
    return this.suspendSellerUseCase.execute(cmd);
  }

  async reinstateSeller(
    cmd: ReinstateSellerCommand,
  ): Promise<
    Result<ReinstateSellerResult, SellerApplicationNotFoundError | InvalidSellerStatusError>
  > {
    return this.reinstateSellerUseCase.execute(cmd);
  }

  async updateProfile(
    cmd: UpdateProfileCommand,
  ): Promise<Result<UpdateProfileResult, SellerApplicationNotFoundError>> {
    return this.updateProfileUseCase.execute(cmd);
  }

  async updateCommission(
    cmd: UpdateCommissionCommand,
  ): Promise<Result<UpdateCommissionResult, SellerApplicationNotFoundError>> {
    return this.updateCommissionUseCase.execute(cmd);
  }

  async removeDocument(
    cmd: RemoveDocumentCommand,
  ): Promise<
    Result<
      RemoveDocumentResult,
      SellerApplicationNotFoundError | InvalidSellerStatusError | SellerDocumentNotFoundError
    >
  > {
    return this.removeDocumentUseCase.execute(cmd);
  }

  async saveBankAccount(
    cmd: SaveBankAccountCommand,
  ): Promise<Result<SaveBankAccountResult, SellerApplicationNotFoundError>> {
    return this.saveBankAccountUseCase.execute(cmd);
  }

  async getMySeller(
    cmd: GetMySellerCommand,
  ): Promise<Result<GetMySellerResult, SellerApplicationNotFoundError>> {
    return this.getMySellerQuery.execute(cmd);
  }

  async getSellerById(cmd: GetSellerByIdCommand): Promise<Seller | null> {
    return this.getSellerByIdQuery.execute(cmd);
  }

  async listApplications(
    cmd: ListApplicationsCommand,
  ): Promise<Result<CursorPage<SellerApplicationSummary>, never>> {
    return this.listApplicationsQuery.execute(cmd);
  }

  async getApplicationDetail(
    cmd: GetApplicationDetailCommand,
  ): Promise<Result<SellerApplicationDetail, SellerApplicationNotFoundError>> {
    return this.getApplicationDetailQuery.execute(cmd);
  }

  async getDocumentDownloadUrl(
    cmd: GetDocumentDownloadUrlCommand,
  ): Promise<Result<GetDocumentDownloadUrlResult, SellerDocumentNotFoundError>> {
    return this.getDocumentDownloadUrlQuery.execute(cmd);
  }

  async listMyDocuments(
    cmd: ListMyDocumentsCommand,
  ): Promise<Result<SellerApplicationDocumentSummary[], SellerApplicationNotFoundError>> {
    return this.listMyDocumentsQuery.execute(cmd);
  }

  async inviteTeamMember(
    cmd: InviteTeamMemberCommand,
  ): Promise<
    Result<
      InviteTeamMemberResult,
      | SellerApplicationNotFoundError
      | CannotInviteSelfError
      | SellerInvitationAlreadyExistsError
      | SellerTeamMemberAlreadyExistsError
      | InsufficientTeamRoleError
    >
  > {
    return this.inviteTeamMemberUseCase.execute(cmd);
  }

  async listTeamMembers(cmd: ListTeamMembersCommand): Promise<CursorPage<SellerTeamMember>> {
    return this.listTeamMembersQuery.execute(cmd);
  }

  async removeTeamMember(
    cmd: RemoveTeamMemberCommand,
  ): Promise<
    Result<
      RemoveTeamMemberResult,
      SellerTeamMemberNotFoundError | CannotRemoveOwnerError | InsufficientTeamRoleError
    >
  > {
    return this.removeTeamMemberUseCase.execute(cmd);
  }

  async updateTeamMemberRole(
    cmd: UpdateTeamMemberRoleCommand,
  ): Promise<
    Result<
      UpdateTeamMemberRoleResult,
      SellerTeamMemberNotFoundError | CannotDemoteOwnerError | InsufficientTeamRoleError
    >
  > {
    return this.updateTeamMemberRoleUseCase.execute(cmd);
  }

  async acceptTeamInvitation(
    cmd: AcceptTeamInvitationCommand,
  ): Promise<
    Result<
      AcceptTeamInvitationResult,
      | SellerInvitationNotFoundError
      | SellerInvitationExpiredError
      | SellerInvitationAlreadyAcceptedError
      | SellerInvitationCancelledError
      | SellerTeamMemberAlreadyExistsError
      | SellerApplicationNotFoundError
    >
  > {
    return this.acceptTeamInvitationUseCase.execute(cmd);
  }

  async cancelInvitation(
    cmd: CancelInvitationCommand,
  ): Promise<
    Result<
      CancelInvitationResult,
      | SellerInvitationNotFoundError
      | SellerInvitationAlreadyAcceptedError
      | SellerInvitationCancelledError
      | InsufficientTeamRoleError
    >
  > {
    return this.cancelInvitationUseCase.execute(cmd);
  }

  async listInvitations(cmd: ListInvitationsCommand): Promise<CursorPage<SellerInvitation>> {
    return this.listInvitationsQuery.execute(cmd);
  }

  async checkTeamMembership(cmd: {
    userId: string;
    sellerId: string;
    requiredRoles: SellerTeamRole[];
  }): Promise<{ ok: boolean }> {
    const member = await this.getMySeller({ userId: cmd.userId });
    if (!member.ok) {
      return { ok: false };
    }
    if (member.value.seller.id !== cmd.sellerId) {
      return { ok: false };
    }
    const teamMember = await this.listTeamMembers({
      sellerId: cmd.sellerId,
      cursor: undefined,
      limit: 100,
    });
    const userMember = teamMember.items.find((m) => m.userId === cmd.userId);
    if (!userMember) {
      return { ok: false };
    }
    const roleLevel = (role: SellerTeamRole): number => {
      switch (role) {
        case 'OWNER':
          return 4;
        case 'MANAGER':
          return 3;
        case 'STAFF':
          return 2;
        case 'VIEW_ONLY':
          return 1;
        default:
          return 0;
      }
    };
    const userLevel = roleLevel(userMember.role);
    const hasRole = cmd.requiredRoles.some((r) => roleLevel(r) <= userLevel);
    return { ok: hasRole };
  }
}
