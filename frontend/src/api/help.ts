import { api } from "./index";

// GET /v1/help/articles — fully public. Not in 05-API-SPEC.md: admin-authored FAQ content
// (Phase 8), recommended over a hardcoded in-app FAQ so staff can edit it without an app release.
export type HelpArticleView = {
  id: string;
  category: string;
  title: string;
  body: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export function listHelpArticles(): Promise<{ items: HelpArticleView[] }> {
  return api.request<{ items: HelpArticleView[] }>("/help/articles", { auth: false });
}
