import { z } from 'zod';

const roleEnum = z.enum(['OWNER', 'MANAGER', 'STAFF', 'VIEW_ONLY']);

export const InviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: roleEnum,
});

export type InviteTeamMemberDto = z.infer<typeof InviteTeamMemberSchema>;

export const UpdateTeamMemberRoleSchema = z.object({
  role: roleEnum,
});

export type UpdateTeamMemberRoleDto = z.infer<typeof UpdateTeamMemberRoleSchema>;

export const AcceptTeamInvitationSchema = z.object({
  token: z.string(),
});

export type AcceptTeamInvitationDto = z.infer<typeof AcceptTeamInvitationSchema>;

export const ListTeamMembersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type ListTeamMembersQueryDto = z.infer<typeof ListTeamMembersQuerySchema>;

export const ListInvitationsQuerySchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type ListInvitationsQueryDto = z.infer<typeof ListInvitationsQuerySchema>;
