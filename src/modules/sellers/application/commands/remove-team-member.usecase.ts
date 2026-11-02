import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import {
  SELLER_TEAM_REPOSITORY,
  SellerTeamRepositoryPort,
} from '../../domain/ports/seller-team.repository.port';
import {
  SellerTeamMemberNotFoundError,
  CannotRemoveOwnerError,
  InsufficientTeamRoleError,
} from '../../domain/errors/sellers.errors';

export interface RemoveTeamMemberCommand {
  readonly requesterUserId: string;
  readonly sellerId: string;
  readonly memberId: string;
}

export interface RemoveTeamMemberResult {
  readonly memberId: string;
  readonly removed: true;
}

@Injectable()
export class RemoveTeamMemberUseCase {
  constructor(@Inject(SELLER_TEAM_REPOSITORY) private readonly team: SellerTeamRepositoryPort) {}

  async execute(
    cmd: RemoveTeamMemberCommand,
  ): Promise<
    Result<
      RemoveTeamMemberResult,
      SellerTeamMemberNotFoundError | CannotRemoveOwnerError | InsufficientTeamRoleError
    >
  > {
    const requester = await this.team.findBySellerIdAndUserId(cmd.sellerId, cmd.requesterUserId);
    if (!requester) {
      return Err(new InsufficientTeamRoleError('OWNER or MANAGER', 'NONE'));
    }
    const requesterRole = requester.role;
    const isOwner = requesterRole === 'OWNER';
    const isManager = requesterRole === 'MANAGER';
    if (!isOwner && !isManager) {
      return Err(new InsufficientTeamRoleError('OWNER or MANAGER', requesterRole));
    }

    const member = await this.team.findById(cmd.memberId);
    if (!member || member.sellerId !== cmd.sellerId) {
      return Err(new SellerTeamMemberNotFoundError(cmd.memberId));
    }

    const memberRole = member.role;
    const isMemberOwner = memberRole === 'OWNER';
    const isMemberManager = memberRole === 'MANAGER';

    if (isMemberOwner) {
      return Err(new CannotRemoveOwnerError());
    }

    if (isManager && (isMemberManager || isMemberOwner)) {
      return Err(new InsufficientTeamRoleError('OWNER', requesterRole));
    }

    await this.team.delete(cmd.memberId);
    return Ok({ memberId: cmd.memberId, removed: true });
  }
}
