import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import { ulid } from 'ulid';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import {
  SELLER_TEAM_REPOSITORY,
  SellerTeamRepositoryPort,
} from '../../domain/ports/seller-team.repository.port';
import {
  SELLER_INVITATION_REPOSITORY,
  SellerInvitationRepositoryPort,
} from '../../domain/ports/seller-team.repository.port';
import { NotificationsService } from '../../../notifications/application/notifications.service';
import { SellerApplicationNotFoundError } from '../../domain/errors/sellers.errors';
import {
  SellerTeamMemberAlreadyExistsError,
  CannotInviteSelfError,
  SellerInvitationAlreadyExistsError,
} from '../../domain/errors/sellers.errors';
import { SellerTeamRole } from '../../domain/entities/seller-team.entity';

export interface InviteTeamMemberCommand {
  readonly inviterUserId: string;
  readonly sellerId: string;
  readonly email: string;
  readonly role: SellerTeamRole;
}

export interface InviteTeamMemberResult {
  readonly invitationId: string;
  readonly email: string;
  readonly role: SellerTeamRole;
  readonly expiresAt: Date;
}

@Injectable()
export class InviteTeamMemberUseCase {
  constructor(
    @Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort,
    @Inject(SELLER_TEAM_REPOSITORY) private readonly team: SellerTeamRepositoryPort,
    @Inject(SELLER_INVITATION_REPOSITORY)
    private readonly invitations: SellerInvitationRepositoryPort,
    private readonly notifications: NotificationsService,
  ) {}

  async execute(
    cmd: InviteTeamMemberCommand,
  ): Promise<
    Result<
      InviteTeamMemberResult,
      | SellerApplicationNotFoundError
      | CannotInviteSelfError
      | SellerInvitationAlreadyExistsError
      | SellerTeamMemberAlreadyExistsError
    >
  > {
    const seller = await this.sellers.findById(cmd.sellerId);
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`seller ${cmd.sellerId}`));
    }

    const inviter = await this.team.findBySellerIdAndUserId(cmd.sellerId, cmd.inviterUserId);
    if (!inviter) {
      return Err(
        new SellerApplicationNotFoundError(`inviter ${cmd.inviterUserId} not a team member`),
      );
    }
    if (inviter.role !== 'OWNER' && inviter.role !== 'MANAGER') {
      return Err(
        new SellerApplicationNotFoundError(`inviter ${cmd.inviterUserId} lacks permission`),
      );
    }

    // Check if the invitee is the same as the seller owner
    if (cmd.email === seller.userId) {
      return Err(new CannotInviteSelfError());
    }

    const existingInvite = await this.invitations.findBySellerIdAndEmail(cmd.sellerId, cmd.email);
    if (existingInvite && existingInvite.status === 'PENDING') {
      return Err(new SellerInvitationAlreadyExistsError(cmd.sellerId, cmd.email));
    }

    const invitationId = ulid();
    const token = ulid();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.invitations.create({
      id: invitationId,
      sellerId: cmd.sellerId,
      email: cmd.email,
      role: cmd.role,
      token,
      expiresAt,
    });

    // Send invitation email
    const appConfig = (await import('../../../../config/app.config')).appConfig;
    const acceptUrl = `${appConfig.publicAppUrl}/team/accept?token=${token}`;
    const roleLabel =
      cmd.role === 'VIEW_ONLY' ? 'View only' : cmd.role.charAt(0) + cmd.role.slice(1).toLowerCase();

    try {
      await this.notifications.sendRawEmail(
        cmd.email,
        `You're invited to join ${seller.displayName} as ${roleLabel}`,
        `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h1 style="color: #111; font-size: 24px; margin-bottom: 16px;">You're invited to join a seller team</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">
              <strong>${seller.displayName}</strong> invited you to join <strong>${seller.displayName}</strong> as a <strong>${roleLabel}</strong>.
            </p>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">
              Click the button below to accept the invitation and access the seller portal.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${acceptUrl}" style="display: inline-block; background-color: #0066CC; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #666; font-size: 14px; line-height: 1.5;">
              This invitation expires on ${expiresAt.toLocaleDateString()}. If you didn't expect this invitation, you can ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">
              This email was sent from Swish. If you have questions, contact support.
            </p>
          </div>
        `,
      );
    } catch (emailErr) {
      // Log but don't fail the invitation - the email is best effort
      console.warn('[InviteTeamMemberUseCase] Failed to send invitation email:', emailErr);
    }

    return Ok({
      invitationId: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    });
  }
}
