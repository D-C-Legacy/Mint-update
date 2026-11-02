import { api, ApiError } from './index';

// Seller application, bank account, and profile (05-API-SPEC.md §3). Not previously used by the
// app — the whole seller side was mock until Phase 7.
export type SellerType = 'INDIVIDUAL' | 'BUSINESS';
export type SellerStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type ApplicationDecision = 'PENDING' | 'APPROVED' | 'REJECTED';

export type SellerApplication = {
  id: string;
  sellerId: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  decision: ApplicationDecision;
  rejectionReason: string | null;
  formData: Record<string, unknown>;
};

export type Seller = {
  id: string;
  userId: string;
  type: SellerType;
  legalName: string;
  displayName: string;
  status: SellerStatus;
  commissionBps: number;
  payoutHoldDays: number;
  application: SellerApplication;
};

// Team management (new for seller team feature)
export type SellerTeamRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'VIEW_ONLY';
export type SellerInvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';

export type SellerTeamMember = {
  id: string;
  sellerId: string;
  userId: string;
  role: SellerTeamRole;
  createdAt: string;
  updatedAt: string;
};

export type SellerInvitation = {
  id: string;
  sellerId: string;
  email: string;
  role: SellerTeamRole;
  token: string;
  status: SellerInvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeamMemberPage = { items: SellerTeamMember[]; nextCursor: string | null };
export type InvitationPage = { items: SellerInvitation[]; nextCursor: string | null };

// GET /seller/application (or /seller/profile — same data either way, one GetMySellerQuery
// behind both routes). Null means the user has never started an application
// (SELLER_APPLICATION_NOT_FOUND) — not an error state the app should show as a failure.
export async function getMySeller(): Promise<Seller | null> {
  try {
    return await api.request<Seller>('/seller/application');
  } catch (err) {
    if (err instanceof ApiError && err.code === 'SELLER_APPLICATION_NOT_FOUND') {
      return null;
    }
    throw err;
  }
}

// POST /seller/application: start or update a DRAFT application. `formData` has no documented
// shape (05-API-SPEC.md's own schema is `z.record(unknown)`) — sent empty, nothing invented.
export function saveApplication(input: {
  type: SellerType;
  legalName: string;
  displayName: string;
}): Promise<Seller> {
  return api.request<Seller>('/seller/application', {
    method: 'POST',
    body: { ...input, formData: {} },
  });
}

export function submitApplication(): Promise<{ status: SellerStatus }> {
  return api.request<{ status: SellerStatus }>('/seller/application/submit', { method: 'POST' });
}

export function withdrawApplication(): Promise<{ status: SellerStatus }> {
  return api.request<{ status: SellerStatus }>('/seller/application/withdraw', { method: 'POST' });
}

export function saveBankAccount(input: {
  accountHolder: string;
  accountNumber: string;
  bankName?: string;
  country: string;
  currency: string;
}): Promise<{ sellerId: string; last4: string }> {
  return api.request<{ sellerId: string; last4: string }>('/seller/bank-account', {
    method: 'POST',
    body: input,
  });
}

// 05-API-SPEC.md says "display name, bio" — there is no `bio` column on Seller, so only
// displayName is real (same gap the backend's own DTO comment flags).
export function updateSellerProfile(displayName: string): Promise<Seller> {
  return api.request<Seller>('/seller/profile', { method: 'PATCH', body: { displayName } });
}

// Team management API calls (new for seller team feature)
export function inviteTeamMember(
  email: string,
  role: SellerTeamRole,
): Promise<{ invitationId: string; email: string; role: SellerTeamRole; expiresAt: string }> {
  return api.request('/seller/team/invite', { method: 'POST', body: { email, role } });
}

export function listTeamMembers(cursor?: string): Promise<TeamMemberPage> {
  return api.request<TeamMemberPage>('/seller/team', { query: { cursor, limit: 20 } });
}

export function removeTeamMember(memberId: string): Promise<{ memberId: string; removed: true }> {
  return api.request(`/seller/team/${encodeURIComponent(memberId)}`, { method: 'DELETE' });
}

export function updateTeamMemberRole(
  memberId: string,
  role: SellerTeamRole,
): Promise<{ memberId: string; role: SellerTeamRole }> {
  return api.request(`/seller/team/${encodeURIComponent(memberId)}/role`, {
    method: 'PATCH',
    body: { role },
  });
}

export function acceptTeamInvitation(
  token: string,
): Promise<{ invitationId: string; sellerId: string; role: string }> {
  return api.request('/seller/team/accept', { method: 'POST', body: { token } });
}

export function listInvitations(
  status?: SellerInvitationStatus,
  cursor?: string,
): Promise<InvitationPage> {
  return api.request<InvitationPage>('/seller/team/invitations', {
    query: { status, cursor, limit: 20 },
  });
}

export function cancelInvitation(
  invitationId: string,
): Promise<{ invitationId: string; cancelled: true }> {
  return api.request(`/seller/team/invitations/${encodeURIComponent(invitationId)}`, {
    method: 'DELETE',
  });
}
