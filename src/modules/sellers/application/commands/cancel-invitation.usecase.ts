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
import {
  SellerInvitationNotFoundError,
  SellerInvitationAlreadyAcceptedError,
  SellerInvitationCancelledError,
  InsufficientTeamRoleError,
} from '../../domain/errors/sellers.errors';

export interface CancelInvitationCommand {
  readonly requesterUserId: string;
  readonly sellerId: string;
  readonly invitationId: string;
}

export interface CancelInvitationResult {
  readonly invitationId: string;
  readonly cancelled: true;
}

@Injectable()
export class CancelInvitationUseCase {
  constructor(
    @Inject(SELLER_INVITATION_REPOSITORY)
    private readonly invitations: SellerInvitationRepositoryPort,
    @Inject(SELLER_TEAM_REPOSITORY) private readonly team: SellerTeamRepositoryPort,
  ) {}

  async execute(
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
    const requester = await this.team.findBySellerIdAndUserId(cmd.sellerId, cmd.requesterUserId);
    if (!requester) {
      return Err(new InsufficientTeamRoleError('OWNER or MANAGER', 'NONE'));
    }
    if (requester.role !== 'OWNER' && requester.role !== 'MANAGER') {
      return Err(new InsufficientTeamRoleError('OWNER or MANAGER', requester.role));
    }

    const invitation = await this.invitations.findById(cmd.invitationId);
    if (!invitation || invitation.sellerId !== cmd.sellerId) {
      return Err(new SellerInvitationNotFoundError(cmd.invitationId));
    }

    if (invitation.status === 'ACCEPTED') {
      return Err(new SellerInvitationAlreadyAcceptedError());
    }
    if (invitation.status === 'CANCELLED') {
      return Err(new SellerInvitationCancelledError());
    }

    await this.invitations.updateStatus(invitation.id, 'CANCELLED');
    return Ok({ invitationId: cmd.invitationId, cancelled: true });
  }
}
