export type SellerTeamRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'VIEW_ONLY';
export type SellerInvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';

export interface SellerTeamMember {
  readonly id: string;
  readonly sellerId: string;
  readonly userId: string;
  readonly role: SellerTeamRole;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SellerInvitation {
  readonly id: string;
  readonly sellerId: string;
  readonly email: string;
  readonly role: SellerTeamRole;
  readonly token: string;
  readonly status: SellerInvitationStatus;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
