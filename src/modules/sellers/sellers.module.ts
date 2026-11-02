import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { StorageModule } from '../../platform/storage/storage.module';
import { EventsModule } from '../../platform/events/events.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SELLER_REPOSITORY } from './domain/ports/seller.repository.port';
import { SELLER_DOCUMENT_REPOSITORY } from './domain/ports/seller-document.repository.port';
import { SELLER_BANK_ACCOUNT_REPOSITORY } from './domain/ports/seller-bank-account.repository.port';
import { SELLER_TEAM_REPOSITORY } from './domain/ports/seller-team.repository.port';
import { SELLER_INVITATION_REPOSITORY } from './domain/ports/seller-team.repository.port';
import { SellerPrismaRepository } from './infra/repositories/seller.prisma.repository';
import { SellerDocumentPrismaRepository } from './infra/repositories/seller-document.prisma.repository';
import { SellerBankAccountPrismaRepository } from './infra/repositories/seller-bank-account.prisma.repository';
import { SellerTeamPrismaRepository } from './infra/repositories/seller-team.prisma.repository';
import { SellerInvitationPrismaRepository } from './infra/repositories/seller-invitation.prisma.repository';
import { SaveDraftUseCase } from './application/commands/save-draft.usecase';
import { RequestDocumentUploadUseCase } from './application/commands/request-document-upload.usecase';
import { AttachDocumentUseCase } from './application/commands/attach-document.usecase';
import { SubmitApplicationUseCase } from './application/commands/submit-application.usecase';
import { WithdrawApplicationUseCase } from './application/commands/withdraw-application.usecase';
import { ApproveApplicationUseCase } from './application/commands/approve-application.usecase';
import { RejectApplicationUseCase } from './application/commands/reject-application.usecase';
import { SuspendSellerUseCase } from './application/commands/suspend-seller.usecase';
import { ReinstateSellerUseCase } from './application/commands/reinstate-seller.usecase';
import { UpdateProfileUseCase } from './application/commands/update-profile.usecase';
import { UpdateCommissionUseCase } from './application/commands/update-commission.usecase';
import { RemoveDocumentUseCase } from './application/commands/remove-document.usecase';
import { SaveBankAccountUseCase } from './application/commands/save-bank-account.usecase';
import { InviteTeamMemberUseCase } from './application/commands/invite-team-member.usecase';
import { RemoveTeamMemberUseCase } from './application/commands/remove-team-member.usecase';
import { UpdateTeamMemberRoleUseCase } from './application/commands/update-team-member-role.usecase';
import { AcceptTeamInvitationUseCase } from './application/commands/accept-team-invitation.usecase';
import { CancelInvitationUseCase } from './application/commands/cancel-invitation.usecase';
import { GetMySellerQuery } from './application/queries/get-my-seller.query';
import { GetSellerByIdQuery } from './application/queries/get-seller-by-id.query';
import { ListApplicationsQuery } from './application/queries/list-applications.query';
import { GetApplicationDetailQuery } from './application/queries/get-application-detail.query';
import { GetDocumentDownloadUrlQuery } from './application/queries/get-document-download-url.query';
import { ListMyDocumentsQuery } from './application/queries/list-my-documents.query';
import { ListTeamMembersQueryImpl } from './application/queries/list-team-members.query';
import { ListInvitationsQueryImpl } from './application/queries/list-invitations.query';
import { TeamInvitationTemplateRegistrar } from './events/handlers/team-invitation-template.registrar';
import { SellersService } from './application/sellers.service';
import { SellersController } from './api/http/sellers.controller';
// The team guard injects SellersService, so its provider lives in this module (not AuthModule).
import { SellerTeamGuard } from '../../platform/auth/seller-team.guard';

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    EventsModule,
    AuthModule,
    RateLimitModule,
    // forwardRef: NotificationsModule already imports SellersModule (its handlers use the
    // SellersService facade), so the evaluation order of the Sellers ↔ Notifications ↔ Channels
    // module cycle must be resolved lazily — without it the import evaluates to `undefined` at
    // boot and Nest crashes with "module at index [5] is undefined".
    forwardRef(() => NotificationsModule),
  ],
  controllers: [SellersController],
  providers: [
    { provide: SELLER_REPOSITORY, useClass: SellerPrismaRepository },
    { provide: SELLER_DOCUMENT_REPOSITORY, useClass: SellerDocumentPrismaRepository },
    { provide: SELLER_BANK_ACCOUNT_REPOSITORY, useClass: SellerBankAccountPrismaRepository },
    { provide: SELLER_TEAM_REPOSITORY, useClass: SellerTeamPrismaRepository },
    { provide: SELLER_INVITATION_REPOSITORY, useClass: SellerInvitationPrismaRepository },
    SaveDraftUseCase,
    RequestDocumentUploadUseCase,
    AttachDocumentUseCase,
    SubmitApplicationUseCase,
    WithdrawApplicationUseCase,
    ApproveApplicationUseCase,
    RejectApplicationUseCase,
    SuspendSellerUseCase,
    ReinstateSellerUseCase,
    UpdateProfileUseCase,
    UpdateCommissionUseCase,
    RemoveDocumentUseCase,
    SaveBankAccountUseCase,
    InviteTeamMemberUseCase,
    RemoveTeamMemberUseCase,
    UpdateTeamMemberRoleUseCase,
    AcceptTeamInvitationUseCase,
    CancelInvitationUseCase,
    GetMySellerQuery,
    GetSellerByIdQuery,
    ListApplicationsQuery,
    GetApplicationDetailQuery,
    GetDocumentDownloadUrlQuery,
    ListMyDocumentsQuery,
    ListTeamMembersQueryImpl,
    ListInvitationsQueryImpl,
    TeamInvitationTemplateRegistrar,
    SellerTeamGuard,
    SellersService,
  ],
  exports: [SellersService],
})
export class SellersModule {}
