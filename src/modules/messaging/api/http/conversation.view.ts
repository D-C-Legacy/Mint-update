import { Conversation } from '../../domain/entities/conversation.entity';

// `otherParty` is filled in by the controller (it needs a seller-display-name lookup the view
// itself has no access to) — same "view assembled from more than one source" shape as
// OrderView's shipping address.
export function toConversationView(
  conversation: Conversation,
  viewerUserId: string,
  otherParty: { readonly id: string; readonly displayName: string },
): Record<string, unknown> {
  const isBuyer = conversation.buyerUserId === viewerUserId;
  return {
    id: conversation.id,
    sellerId: conversation.sellerId,
    otherParty,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    lastMessageBody: conversation.lastMessageBody,
    unread: isBuyer ? conversation.buyerUnread : conversation.sellerUnread,
    createdAt: conversation.createdAt.toISOString(),
  };
}
