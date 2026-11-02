import { api } from "./index";
import type { Page } from "./catalog";

// Not in 05-API-SPEC.md — no messaging model exists in the docs at all (Phase 8). Buyer-initiated
// only: a seller cold-messaging a buyer first was never asked for.
export type ConversationView = {
  id: string;
  sellerId: string;
  otherParty: { id: string; displayName: string };
  lastMessageAt: string;
  lastMessageBody: string | null;
  unread: boolean;
  createdAt: string;
};

export type MessageView = {
  id: string;
  conversationId: string;
  body: string;
  mine: boolean;
  createdAt: string;
};

export function listMyConversations(cursor?: string): Promise<Page<ConversationView>> {
  return api.request<Page<ConversationView>>("/me/conversations", { query: { limit: 20, cursor } });
}

// No "get conversation by seller" route exists — same page-walking approach channels.ts's
// isFollowing() already uses for an equivalent single-lookup-over-a-list problem.
export async function findConversationBySeller(sellerId: string): Promise<ConversationView | null> {
  let cursor: string | undefined;
  do {
    const page = await listMyConversations(cursor);
    const match = page.items.find((c) => c.sellerId === sellerId);
    if (match) return match;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return null;
}

// Find-or-create: messaging the same seller twice reuses one thread.
export function startConversation(sellerId: string, body: string): Promise<ConversationView> {
  return api.request<ConversationView>("/me/conversations", { method: "POST", body: { sellerId, body } });
}

export function listMessages(conversationId: string, cursor?: string): Promise<Page<MessageView>> {
  return api.request<Page<MessageView>>(`/me/conversations/${encodeURIComponent(conversationId)}/messages`, {
    query: { limit: 30, cursor },
  });
}

export function sendMessage(conversationId: string, body: string): Promise<MessageView> {
  return api.request<MessageView>(`/me/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    body: { body },
  });
}

export function markConversationRead(conversationId: string): Promise<ConversationView> {
  return api.request<ConversationView>(`/me/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: "POST",
  });
}
