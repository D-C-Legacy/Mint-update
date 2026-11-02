// Typed wrappers around the admin help-article CRUD routes (Phase 8 — not in 05-API-SPEC.md,
// recommended over a hardcoded in-app FAQ so staff can edit content without an app release).
import { apiClient } from '../auth/AuthContext';

export type HelpArticle = {
  id: string;
  category: string;
  title: string;
  body: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export function listHelpArticles(): Promise<{ items: HelpArticle[] }> {
  return apiClient.request('/admin/help/articles');
}

export function createHelpArticle(input: { category: string; title: string; body: string; sortOrder: number }): Promise<HelpArticle> {
  return apiClient.request('/admin/help/articles', { method: 'POST', body: input });
}

export function updateHelpArticle(
  id: string,
  input: Partial<{ category: string; title: string; body: string; sortOrder: number; isPublished: boolean }>,
): Promise<HelpArticle> {
  return apiClient.request(`/admin/help/articles/${id}`, { method: 'PATCH', body: input });
}

export function deleteHelpArticle(id: string): Promise<{ deleted: true }> {
  return apiClient.request(`/admin/help/articles/${id}/delete`, { method: 'POST' });
}
