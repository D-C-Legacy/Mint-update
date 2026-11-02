import {
  SellerTeamMember,
  SellerTeamRole,
  SellerInvitation,
  SellerInvitationStatus,
} from '../entities/seller-team.entity';

export const SELLER_TEAM_REPOSITORY = Symbol('SellerTeamRepositoryPort');
export const SELLER_INVITATION_REPOSITORY = Symbol('SellerInvitationRepositoryPort');

export interface CreateTeamMemberInput {
  readonly id: string;
  readonly sellerId: string;
  readonly userId: string;
  readonly role: SellerTeamRole;
}

export interface UpdateTeamMemberInput {
  readonly role: SellerTeamRole;
}

export interface ListTeamMembersFilter {
  readonly sellerId: string;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface SellerTeamRepositoryPort {
  findById(id: string): Promise<SellerTeamMember | null>;
  findBySellerIdAndUserId(sellerId: string, userId: string): Promise<SellerTeamMember | null>;
  findByUserId(userId: string): Promise<SellerTeamMember[]>;
  create(input: CreateTeamMemberInput): Promise<SellerTeamMember>;
  update(memberId: string, input: UpdateTeamMemberInput): Promise<SellerTeamMember>;
  delete(memberId: string): Promise<void>;
  list(filter: ListTeamMembersFilter): Promise<SellerTeamMember[]>;
}

export interface CreateInvitationInput {
  readonly id: string;
  readonly sellerId: string;
  readonly email: string;
  readonly role: SellerTeamRole;
  readonly token: string;
  readonly expiresAt: Date;
}

export interface ListInvitationsFilter {
  readonly sellerId: string;
  readonly status: SellerInvitationStatus | undefined;
  readonly cursor: string | undefined;
  readonly limit: number;
}

export interface SellerInvitationRepositoryPort {
  findById(id: string): Promise<SellerInvitation | null>;
  findByToken(token: string): Promise<SellerInvitation | null>;
  findBySellerIdAndEmail(sellerId: string, email: string): Promise<SellerInvitation | null>;
  create(input: CreateInvitationInput): Promise<SellerInvitation>;
  updateStatus(
    id: string,
    status: SellerInvitationStatus,
    acceptedAt?: Date,
  ): Promise<SellerInvitation>;
  list(filter: ListInvitationsFilter): Promise<SellerInvitation[]>;
}
