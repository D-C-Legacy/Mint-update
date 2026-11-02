import { Injectable, Inject } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../shared/result/result';
import {
  SELLER_TEAM_REPOSITORY,
  SellerTeamRepositoryPort,
} from '../../domain/ports/seller-team.repository.port';
import { SellerTeamRole } from '../../domain/entities/seller-team.entity';
import {
  SellerTeamMemberNotFoundError,
  CannotDemoteOwnerError,
  InsufficientTeamRoleError,
} from '../../domain/errors/sellers.errors';

export interface UpdateTeamMemberRoleCommand {
  readonly requesterUserId: string;
  readonly sellerId: string;
  readonly memberId: string;
  readonly role: SellerTeamRole;
}

export interface UpdateTeamMemberRoleResult {
  readonly memberId: string;
  readonly role: SellerTeamRole;
}

@Injectable()
export class UpdateTeamMemberRoleUseCase {
  constructor(@Inject(SELLER_TEAM_REPOSITORY) private readonly team: SellerTeamRepositoryPort) {}

  async execute(
    cmd: UpdateTeamMemberRoleCommand,
  ): Promise<
    Result<
      UpdateTeamMemberRoleResult,
      SellerTeamMemberNotFoundError | CannotDemoteOwnerError | InsufficientTeamRoleError
    >
  > {
    const requester = await this.team.findBySellerIdAndUserId(cmd.sellerId, cmd.requesterUserId);
    if (!requester) {
      return Err(new InsufficientTeamRoleError('OWNER', 'NONE'));
    }
    if (requester.role !== 'OWNER') {
      return Err(new InsufficientTeamRoleError('OWNER', requester.role));
    }

    const member = await this.team.findById(cmd.memberId);
    if (!member || member.sellerId !== cmd.sellerId) {
      return Err(new SellerTeamMemberNotFoundError(cmd.memberId));
    }

    if (member.role === 'OWNER') {
      return Err(new CannotDemoteOwnerError());
    }

    if (cmd.role === 'OWNER') {
      return Err(new InsufficientTeamRoleError('OWNER cannot be assigned', 'OWNER'));
    }

    const updated = await this.team.update(cmd.memberId, { role: cmd.role });
    return Ok({ memberId: updated.id, role: updated.role });
  }
}
