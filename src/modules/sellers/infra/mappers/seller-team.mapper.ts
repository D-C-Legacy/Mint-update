import type {
  SellerTeamMember as PrismaSellerTeamMember,
  SellerInvitation as PrismaSellerInvitation,
} from '@prisma/client';
import { SellerTeamMember, SellerInvitation } from '../../domain/entities/seller-team.entity';

export function toDomainSellerTeamMember(row: PrismaSellerTeamMember): SellerTeamMember {
  return {
    id: row.id,
    sellerId: row.sellerId,
    userId: row.userId,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toDomainSellerInvitation(row: PrismaSellerInvitation): SellerInvitation {
  return {
    id: row.id,
    sellerId: row.sellerId,
    email: row.email,
    role: row.role,
    token: row.token,
    status: row.status,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
