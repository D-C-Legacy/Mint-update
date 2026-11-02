export interface Conversation {
  readonly id: string;
  readonly buyerUserId: string;
  readonly sellerId: string;
  readonly lastMessageAt: Date;
  readonly lastMessageBody: string | null;
  readonly buyerUnread: boolean;
  readonly sellerUnread: boolean;
  readonly createdAt: Date;
}
