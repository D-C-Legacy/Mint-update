// Typed wrappers around the seller-applications admin routes. Shapes mirror the backend
// exactly (src/modules/sellers/domain/entities/seller-application-summary.entity.ts,
// seller.entity.ts, seller-document.entity.ts) — kept in step by hand, not generated.
import { apiClient } from '../auth/AuthContext';

export type SellerType = 'INDIVIDUAL' | 'BUSINESS';
export type SellerStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type ApplicationDecision = 'PENDING' | 'APPROVED' | 'REJECTED';
export type DocumentType = 'GOVERNMENT_ID' | 'PROOF_OF_ADDRESS' | 'BUSINESS_REGISTRATION' | 'TAX_DOCUMENT' | 'OTHER';

export type SellerApplicationSummary = {
  applicationId: string;
  sellerId: string;
  type: SellerType;
  legalName: string;
  displayName: string;
  status: SellerStatus;
  decision: ApplicationDecision;
  submittedAt: string | null;
  reviewedAt: string | null;
};

export type SellerApplicationDocumentSummary = {
  id: string;
  type: DocumentType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  reviewNote: string | null;
};

export type SellerApplicationDetail = SellerApplicationSummary & {
  formData: Record<string, unknown>;
  rejectionReason: string | null;
  reviewedByUserId: string | null;
  documents: SellerApplicationDocumentSummary[];
};

export type CursorPage<T> = { items: T[]; nextCursor: string | null };

export function listApplications(params: {
  decision?: ApplicationDecision;
  cursor?: string;
}): Promise<CursorPage<SellerApplicationSummary>> {
  return apiClient.request('/admin/seller-applications', {
    query: { decision: params.decision, cursor: params.cursor, limit: 20 },
  });
}

export function getApplicationDetail(applicationId: string): Promise<SellerApplicationDetail> {
  return apiClient.request(`/admin/seller-applications/${applicationId}`);
}

export function getDocumentUrl(documentId: string): Promise<{ url: string; storageKey: string }> {
  return apiClient.request(`/admin/documents/${documentId}/url`);
}

export function approveApplication(applicationId: string): Promise<{ sellerId: string; status: SellerStatus }> {
  return apiClient.request(`/admin/seller-applications/${applicationId}/approve`, { method: 'POST' });
}

export function rejectApplication(
  applicationId: string,
  reason: string,
): Promise<{ sellerId: string; status: SellerStatus }> {
  return apiClient.request(`/admin/seller-applications/${applicationId}/reject`, {
    method: 'POST',
    body: { reason },
  });
}

export function updateCommission(
  sellerId: string,
  commissionBps: number,
): Promise<{ sellerId: string; commissionBps: number }> {
  return apiClient.request(`/admin/sellers/${sellerId}/commission`, {
    method: 'PATCH',
    body: { commissionBps },
  });
}

export function suspendSeller(sellerId: string): Promise<{ sellerId: string; status: SellerStatus }> {
  return apiClient.request(`/admin/sellers/${sellerId}/suspend`, { method: 'POST' });
}

export function reinstateSeller(sellerId: string): Promise<{ sellerId: string; status: SellerStatus }> {
  return apiClient.request(`/admin/sellers/${sellerId}/reinstate`, { method: 'POST' });
}
