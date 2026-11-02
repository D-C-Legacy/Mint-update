export interface CursorPage<T> {
  readonly items: T[];
  readonly nextCursor: string | null;
}

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export function normalizeLimit(limit: number | undefined): number {
  if (!limit) {
    return DEFAULT_PAGE_LIMIT;
  }
  return Math.min(Math.max(limit, 1), MAX_PAGE_LIMIT);
}

export function buildCursorPage<T extends { id: string }>(items: T[], limit: number): CursorPage<T> {
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const last = pageItems[pageItems.length - 1];
  return {
    items: pageItems,
    nextCursor: hasMore && last ? last.id : null,
  };
}
