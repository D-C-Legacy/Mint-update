import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import {
  SELLER_INVITATION_REPOSITORY,
  SellerInvitationRepositoryPort,
} from '../../domain/ports/seller-team.repository.port';
import {
  SELLER_TEAM_REPOSITORY,
  SellerTeamRepositoryPort,
} from '../../domain/ports/seller-team.repository.port';
import { SELLER_REPOSITORY, SellerRepositoryPort } from '../../domain/ports/seller.repository.port';
import { ulid } from 'ulid';
import {
  SellerInvitationNotFoundError,
  SellerInvitationExpiredError,
  SellerInvitationAlreadyAcceptedError,
  SellerInvitationCancelledError,
  SellerTeamMemberAlreadyExistsError,
  SellerApplicationNotFoundError,
} from '../../domain/errors/sellers.errors';

export interface AcceptTeamInvitationCommand {
  readonly userId: string;
  readonly token: string;
}

export interface AcceptTeamInvitationResult {
  readonly invitationId: string;
  readonly sellerId: string;
  readonly role: string;
}

@Injectable()
export class AcceptTeamInvitationUseCase {
  constructor(
    @Inject(SELLER_INVITATION_REPOSITORY)
    private readonly invitations: SellerInvitationRepositoryPort,
    @Inject(SELLER_TEAM_REPOSITORY) private readonly team: SellerTeamRepositoryPort,
    @Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepositoryPort,
  ) {}

  async execute(
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
    const invitation = await this.invitations.findByToken(cmd.token);
    if (!invitation) {
      return Err(new SellerInvitationNotFoundError(cmd.token));
    }

    if (invitation.status === 'EXPIRED') {
      return Err(new SellerInvitationExpiredError());
    }
    if (invitation.status === 'ACCEPTED') {
      return Err(new SellerInvitationAlreadyAcceptedError());
    }
    if (invitation.status === 'CANCELLED') {
      return Err(new SellerInvitationCancelledError());
    }
    if (invitation.expiresAt < new Date()) {
      await this.invitations.updateStatus(invitation.id, 'EXPIRED');
      return Err(new SellerInvitationExpiredError());
    }

    const seller = await this.sellers.findById(invitation.sellerId);
    if (!seller) {
      return Err(new SellerApplicationNotFoundError(`seller ${invitation.sellerId}`));
    }

    const existingMember = await this.team.findBySellerIdAndUserId(invitation.sellerId, cmd.userId);
    if (existingMember) {
      return Err(new SellerTeamMemberAlreadyExistsError(invitation.sellerId, cmd.userId));
    }

    await this.invitations.updateStatus(invitation.id, 'ACCEPTED', new Date());

    const memberId = ulid();
    await this.team.create({
      id: memberId,
      sellerId: invitation.sellerId,
      userId: cmd.userId,
      role: invitation.role,
    });

    return Ok({
      invitationId: invitation.id,
      sellerId: invitation.sellerId,
      role: invitation.role,
    });
  }
}
